from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
import html
import math
import os
import re
import time
from typing import Any
from urllib.parse import quote_plus
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

mapsApiKey = "AIzaSyAOVjtt-TvPi31gZcmeedmc4-cMrq9jO5A"
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", mapsApiKey)

CACHE_TTL_NEARBY_SECONDS = 900
CACHE_TTL_GEOCODE_SECONDS = 86400
CACHE_MAX_ENTRIES = 500
NEARBY_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
GEOCODE_CACHE: dict[str, tuple[float, tuple[float, float]]] = {}

try:
    from .credentials import (
        authenticate_admin,
        authenticate_user,
        get_all_admins,
        get_all_users,
        register_user,
        verify_admin_code,
    )
except ImportError:
    from credentials import (  # pragma: no cover
        authenticate_admin,
        authenticate_user,
        get_all_admins,
        get_all_users,
        register_user,
        verify_admin_code,
    )


class AdminCodeRequest(BaseModel):
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class ParkingSpot(BaseModel):
    id: str
    lat: float
    lng: float
    name: str
    address: str | None = None
    distance_km: float | None = None


class NearbyParkingResponse(BaseModel):
    spots: list[ParkingSpot]
    count: int


app = FastAPI(
    title="CityFlow Backend API",
    description="FastAPI backend for CityFlow urban mobility management.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula (in km)"""
    R = 6371  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2 +
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def fetch_google_json(url: str) -> dict[str, Any]:
    with urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_google_json_request(url: str, *, method: str = "GET", data: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request_headers = headers or {}
    encoded_data = None if data is None else json.dumps(data).encode("utf-8")
    request = Request(url, data=encoded_data, headers=request_headers, method=method)
    try:
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=400, detail=f"Google request failed: {error_body}") from exc


def get_cache_value(cache: dict[str, tuple[float, Any]], key: str, ttl_seconds: int) -> Any | None:
    item = cache.get(key)
    if not item:
        return None

    created_at, value = item
    if (time.time() - created_at) > ttl_seconds:
        del cache[key]
        return None

    return value


def set_cache_value(cache: dict[str, tuple[float, Any]], key: str, value: Any) -> None:
    if len(cache) >= CACHE_MAX_ENTRIES:
        oldest_key = min(cache, key=lambda item_key: cache[item_key][0])
        del cache[oldest_key]

    cache[key] = (time.time(), value)


def geocode_google_address(address: str) -> tuple[float, float]:
    normalized_address = " ".join(address.strip().lower().split())
    cache_key = f"geocode:{normalized_address}"
    cached_coords = get_cache_value(GEOCODE_CACHE, cache_key, CACHE_TTL_GEOCODE_SECONDS)
    if cached_coords:
        return cached_coords

    geocode_url = (
        "https://maps.googleapis.com/maps/api/geocode/json"
        f"?address={quote_plus(address)}&key={GOOGLE_MAPS_API_KEY}"
    )
    payload = fetch_google_json(geocode_url)

    if payload.get("status") != "OK" or not payload.get("results"):
        raise HTTPException(status_code=404, detail="Address not found")

    location = payload["results"][0]["geometry"]["location"]
    coords = (float(location["lat"]), float(location["lng"]))
    set_cache_value(GEOCODE_CACHE, cache_key, coords)
    return coords


def reverse_geocode_google(lat: float, lng: float) -> str:
    cache_key = f"reverse:{round(lat, 5)}:{round(lng, 5)}"
    cached_value = get_cache_value(GEOCODE_CACHE, cache_key, CACHE_TTL_GEOCODE_SECONDS)
    if cached_value:
        return str(cached_value)

    reverse_url = (
        "https://maps.googleapis.com/maps/api/geocode/json"
        f"?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}"
    )
    payload = fetch_google_json(reverse_url)
    results = payload.get("results", [])
    if not results:
        raise HTTPException(status_code=404, detail="Address not found")

    address = str(results[0].get("formatted_address", f"{lat}, {lng}"))
    set_cache_value(GEOCODE_CACHE, cache_key, address)
    return address


def strip_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(value or ""))).strip()


def format_transit_line_label(vehicle_name: str, line_name: str) -> str:
    normalized_vehicle = vehicle_name.strip().lower()
    cleaned_line_name = line_name.strip() or "Route"

    if normalized_vehicle in {"subway", "metro"}:
        return f"Metro Line {cleaned_line_name}"
    if normalized_vehicle in {"bus"}:
        return f"Bus {cleaned_line_name}"
    if normalized_vehicle in {"rail", "train", "commuter rail"}:
        return f"Train {cleaned_line_name}"
    if normalized_vehicle in {"light rail", "tram"}:
        return f"Light Rail {cleaned_line_name}"
    return f"{vehicle_name or 'Transit'} {cleaned_line_name}".strip()


def format_transit_mode_label(vehicle_name: str) -> str:
    normalized_vehicle = vehicle_name.strip().lower()
    if normalized_vehicle in {"subway", "metro"}:
        return "Metro"
    if normalized_vehicle in {"bus"}:
        return "Bus"
    if normalized_vehicle in {"rail", "train", "commuter rail"}:
        return "Train"
    if normalized_vehicle in {"light rail", "tram"}:
        return "Light Rail"
    return vehicle_name or "Transit"


def parse_rfc3339_time(value: str) -> str:
    raw_value = str(value or "").strip()
    if not raw_value:
        return ""

    try:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
        return parsed.astimezone().strftime("%-I:%M %p")
    except ValueError:
        return raw_value


def decode_polyline(encoded: str) -> list[list[float]]:
    points: list[list[float]] = []
    index = 0
    lat = 0
    lng = 0

    while index < len(encoded):
        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lat += ~(result >> 1) if result & 1 else (result >> 1)

        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lng += ~(result >> 1) if result & 1 else (result >> 1)

        points.append([lat / 1e5, lng / 1e5])

    return points


def summarize_transit_steps(steps: list[dict[str, Any]]) -> str:
    labels: list[str] = []
    for step in steps:
        if step.get("travel_mode") != "TRANSIT":
            continue

        transit_details = step.get("transit_details", {})
        line = transit_details.get("line", {})
        vehicle = line.get("vehicle", {}).get("name", "Transit")
        short_name = line.get("short_name") or line.get("name") or transit_details.get("headsign") or "Route"
        labels.append(f"{vehicle} {short_name}")

    return " • ".join(labels) if labels else "Transit route"


def map_direction_step(step: dict[str, Any]) -> dict[str, str]:
    travel_mode = str(step.get("travel_mode", ""))
    duration_text = str(step.get("duration", {}).get("text", ""))
    distance_text = str(step.get("distance", {}).get("text", ""))

    if travel_mode == "WALKING":
        return {
            "kind": "walk",
            "mode": "Walk",
            "title": strip_html_text(str(step.get("html_instructions", "Walk"))),
            "detail": " • ".join(value for value in [duration_text, distance_text] if value),
            "lineLabel": "",
            "departureStop": "",
            "arrivalStop": "",
            "departureTime": "",
            "arrivalTime": "",
            "stopCount": "",
        }

    if travel_mode == "TRANSIT":
        transit_details = step.get("transit_details", {})
        line = transit_details.get("line", {})
        vehicle_name = str(line.get("vehicle", {}).get("name", "Transit"))
        line_name = str(line.get("short_name") or line.get("name") or transit_details.get("headsign") or "Transit")
        departure_stop = str(transit_details.get("departure_stop", {}).get("name", "Departure stop"))
        arrival_stop = str(transit_details.get("arrival_stop", {}).get("name", "Arrival stop"))
        stop_count = transit_details.get("num_stops")
        departure_time = str(transit_details.get("departure_time", {}).get("text", ""))
        arrival_time = str(transit_details.get("arrival_time", {}).get("text", ""))
        line_label = format_transit_line_label(vehicle_name, line_name)

        detail_parts = [f"Get off at {arrival_stop}" if arrival_stop else ""]
        if stop_count:
            detail_parts.append(f"{stop_count} stops")
        if duration_text:
            detail_parts.append(duration_text)

        return {
            "kind": "transit",
            "mode": format_transit_mode_label(vehicle_name),
            "title": f"{line_label} from {departure_stop}",
            "detail": " • ".join(part for part in detail_parts if part),
            "lineLabel": line_label,
            "departureStop": departure_stop,
            "arrivalStop": arrival_stop,
            "departureTime": departure_time,
            "arrivalTime": arrival_time,
            "stopCount": str(stop_count or ""),
        }

    return {
        "kind": travel_mode.lower() or "step",
        "mode": travel_mode.title() or "Step",
        "title": strip_html_text(str(step.get("html_instructions", travel_mode.title() or "Step"))),
        "detail": " • ".join(value for value in [duration_text, distance_text] if value),
        "lineLabel": "",
        "departureStop": "",
        "arrivalStop": "",
        "departureTime": "",
        "arrivalTime": "",
        "stopCount": "",
    }


def parse_google_duration_seconds(value: str) -> int:
    match = re.fullmatch(r"(\d+)s", str(value).strip())
    return int(match.group(1)) if match else 0


def format_duration_text_from_seconds(seconds: int) -> str:
    if seconds <= 0:
        return ""

    minutes = max(1, round(seconds / 60))
    hours, remaining_minutes = divmod(minutes, 60)
    if hours and remaining_minutes:
        return f"{hours} hr {remaining_minutes} min"
    if hours:
        return f"{hours} hr"
    return f"{minutes} min"


def get_routes_api_lat_lng(location: dict[str, Any] | None) -> dict[str, float] | None:
    if not location:
        return None

    lat_lng = location.get("latLng", location)
    latitude = lat_lng.get("latitude")
    longitude = lat_lng.get("longitude")

    if latitude is None or longitude is None:
        return None

    return {"lat": float(latitude), "lng": float(longitude)}


def map_routes_api_step(step: dict[str, Any]) -> dict[str, str]:
    travel_mode = str(step.get("travelMode", "")).title()
    localized_values = step.get("localizedValues", {})
    duration_text = (
        str(localized_values.get("staticDuration", {}).get("text", ""))
        or str(localized_values.get("duration", {}).get("text", ""))
        or format_duration_text_from_seconds(parse_google_duration_seconds(str(step.get("staticDuration", ""))))
    )
    distance_text = str(localized_values.get("distance", {}).get("text", ""))

    if travel_mode == "Walk":
        return {
            "kind": "walk",
            "mode": "Walk",
            "title": strip_html_text(str(step.get("navigationInstruction", {}).get("instructions", "Walk"))),
            "detail": " • ".join(value for value in [duration_text, distance_text] if value),
            "lineLabel": "",
            "departureStop": "",
            "arrivalStop": "",
            "departureTime": "",
            "arrivalTime": "",
            "stopCount": "",
        }

    if travel_mode == "Transit":
        transit_details = step.get("transitDetails", {})
        transit_line = transit_details.get("transitLine", {})
        vehicle_name = str(
            transit_line.get("vehicle", {}).get("name", {}).get("text")
            or transit_line.get("vehicle", {}).get("type", "Transit")
        )
        line_name = str(
            transit_line.get("nameShort")
            or transit_line.get("name")
            or transit_details.get("headsign")
            or "Transit"
        )
        stop_details = transit_details.get("stopDetails", {})
        departure_stop = str(stop_details.get("departureStop", {}).get("name", "Departure stop"))
        arrival_stop = str(stop_details.get("arrivalStop", {}).get("name", "Arrival stop"))
        stop_count = transit_details.get("stopCount")
        localized_transit_values = transit_details.get("localizedValues", {})
        departure_time = str(localized_transit_values.get("departureTime", {}).get("time", "")) or parse_rfc3339_time(str(stop_details.get("departureTime", "")))
        arrival_time = str(localized_transit_values.get("arrivalTime", {}).get("time", "")) or parse_rfc3339_time(str(stop_details.get("arrivalTime", "")))
        line_label = format_transit_line_label(vehicle_name, line_name)

        detail_parts = [f"Get off at {arrival_stop}" if arrival_stop else ""]
        if stop_count:
            detail_parts.append(f"{stop_count} stops")
        if duration_text:
            detail_parts.append(duration_text)

        return {
            "kind": "transit",
            "mode": format_transit_mode_label(vehicle_name),
            "title": f"{line_label} from {departure_stop}",
            "detail": " • ".join(part for part in detail_parts if part),
            "lineLabel": line_label,
            "departureStop": departure_stop,
            "arrivalStop": arrival_stop,
            "departureTime": departure_time,
            "arrivalTime": arrival_time,
            "stopCount": str(stop_count or ""),
        }

    return {
        "kind": travel_mode.lower() or "step",
        "mode": travel_mode or "Step",
        "title": strip_html_text(str(step.get("navigationInstruction", {}).get("instructions", travel_mode or "Step"))),
        "detail": " • ".join(value for value in [duration_text, distance_text] if value),
        "lineLabel": "",
        "departureStop": "",
        "arrivalStop": "",
        "departureTime": "",
        "arrivalTime": "",
        "stopCount": "",
    }


def summarize_routes_api_steps(steps: list[dict[str, Any]]) -> str:
    labels: list[str] = []
    for step in steps:
        if str(step.get("travelMode", "")).upper() != "TRANSIT":
            continue

        transit_details = step.get("transitDetails", {})
        transit_line = transit_details.get("transitLine", {})
        vehicle_name = str(
            transit_line.get("vehicle", {}).get("name", {}).get("text")
            or transit_line.get("vehicle", {}).get("type", "Transit")
        )
        line_name = str(
            transit_line.get("nameShort")
            or transit_line.get("name")
            or transit_details.get("headsign")
            or "Route"
        )
        labels.append(format_transit_line_label(vehicle_name, line_name))

    return " • ".join(labels) if labels else "Transit route"


def fetch_transit_routes_v2(origin: str, destination: str) -> list[dict[str, Any]]:
    routes_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    field_mask = ",".join(
        [
            "routes.duration",
            "routes.distanceMeters",
            "routes.polyline.encodedPolyline",
            "routes.legs.startLocation",
            "routes.legs.endLocation",
            "routes.legs.steps.travelMode",
            "routes.legs.steps.navigationInstruction.instructions",
            "routes.legs.steps.localizedValues.distance.text",
            "routes.legs.steps.localizedValues.staticDuration.text",
            "routes.legs.steps.transitDetails",
        ]
    )
    payload = fetch_google_json_request(
        routes_url,
        method="POST",
        data={
            "origin": {"address": origin},
            "destination": {"address": destination},
            "travelMode": "TRANSIT",
            "computeAlternativeRoutes": True,
            "languageCode": "en-CA",
            "units": "METRIC",
            "departureTime": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "transitPreferences": {
                "allowedTravelModes": ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"],
            },
        },
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": field_mask,
        },
    )

    routes: list[dict[str, Any]] = []
    for route in payload.get("routes", []):
        leg = (route.get("legs") or [None])[0]
        if not leg:
            continue

        steps = leg.get("steps", [])
        duration_text = format_duration_text_from_seconds(parse_google_duration_seconds(str(route.get("duration", ""))))
        distance_meters = route.get("distanceMeters")
        distance_text = f"{round(float(distance_meters) / 1000, 1)} km" if distance_meters else ""
        routes.append(
            {
                "summary": summarize_routes_api_steps(steps),
                "durationText": duration_text or "Transit trip",
                "distanceText": distance_text,
                "departureTime": "Leave now",
                "arrivalTime": "",
                "startAddress": origin,
                "endAddress": destination,
                "startLocation": get_routes_api_lat_lng(leg.get("startLocation")),
                "endLocation": get_routes_api_lat_lng(leg.get("endLocation")),
                "path": decode_polyline(str(route.get("polyline", {}).get("encodedPolyline", ""))),
                "steps": [map_routes_api_step(step) for step in steps],
            }
        )

    return routes


def get_nearby_parking_spots(lat: float, lng: float, radius_km: float = 1) -> list[dict[str, Any]]:
    """Get nearby parking from Google Places Nearby Search within given radius (km)."""
    rounded_lat = round(lat, 3)
    rounded_lng = round(lng, 3)
    rounded_radius_km = round(radius_km, 1)
    cache_key = f"nearby:{rounded_lat}:{rounded_lng}:{rounded_radius_km}"
    cached_spots = get_cache_value(NEARBY_CACHE, cache_key, CACHE_TTL_NEARBY_SECONDS)
    if cached_spots is not None:
        return cached_spots

    radius_meters = max(100, min(int(rounded_radius_km * 1000), 50000))
    nearby_url = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={rounded_lat},{rounded_lng}&radius={radius_meters}&type=parking&key={GOOGLE_MAPS_API_KEY}"
    )
    payload = fetch_google_json(nearby_url)

    if payload.get("status") not in {"OK", "ZERO_RESULTS"}:
        raise HTTPException(status_code=400, detail=f"Google Places error: {payload.get('status', 'UNKNOWN_ERROR')}")

    results = payload.get("results", [])
    spots: list[dict[str, Any]] = []
    for place in results:
        geometry = place.get("geometry", {}).get("location")
        if not geometry:
            continue

        place_lat = float(geometry["lat"])
        place_lng = float(geometry["lng"])
        distance = calculate_distance(rounded_lat, rounded_lng, place_lat, place_lng)
        spots.append(
            {
                "id": place.get("place_id", place.get("name", "unknown")),
                "lat": place_lat,
                "lng": place_lng,
                "name": place.get("name", "Parking Spot"),
                "address": place.get("vicinity"),
                "distance_km": round(distance, 2),
            }
        )

    spots.sort(key=lambda item: item.get("distance_km", 0))
    set_cache_value(NEARBY_CACHE, cache_key, spots)
    return spots


@app.get("/")
def root():
    return {"message": "CityFlow API backend is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/config/google-maps-key")
def get_google_maps_key():
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")
    return {"apiKey": GOOGLE_MAPS_API_KEY}


@app.get("/maps/reverse-geocode")
def reverse_geocode(lat: float, lng: float):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")
    return {"address": reverse_geocode_google(lat, lng)}


@app.get("/transit/directions")
def get_transit_directions(origin: str, destination: str):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")

    routes: list[dict[str, Any]] = []
    failure_reasons: list[str] = []

    try:
        routes = fetch_transit_routes_v2(origin, destination)
    except Exception as exc:  # pragma: no cover - depends on upstream API/project config
        failure_reasons.append(f"Routes API fallback failed: {exc}")

    if not routes:
        try:
            directions_url = (
                "https://maps.googleapis.com/maps/api/directions/json"
                f"?origin={quote_plus(origin)}"
                f"&destination={quote_plus(destination)}"
                "&mode=transit"
                "&alternatives=true"
                "&departure_time=now"
                "&region=ca"
                f"&key={GOOGLE_MAPS_API_KEY}"
            )
            payload = fetch_google_json(directions_url)
            status = str(payload.get("status", "UNKNOWN_ERROR"))

            if status not in {"OK", "ZERO_RESULTS"}:
                failure_reasons.append(f"Directions API error: {status}")
            else:
                for route in payload.get("routes", []):
                    leg = (route.get("legs") or [None])[0]
                    if not leg:
                        continue

                    steps = leg.get("steps", [])
                    encoded_points = str(route.get("overview_polyline", {}).get("points", ""))
                    routes.append(
                        {
                            "summary": summarize_transit_steps(steps),
                            "durationText": str(leg.get("duration", {}).get("text", "Transit trip")),
                            "distanceText": str(leg.get("distance", {}).get("text", "")),
                            "departureTime": str(leg.get("departure_time", {}).get("text", "Leave now")),
                            "arrivalTime": str(leg.get("arrival_time", {}).get("text", "")),
                            "startAddress": str(leg.get("start_address", origin)),
                            "endAddress": str(leg.get("end_address", destination)),
                            "startLocation": leg.get("start_location"),
                            "endLocation": leg.get("end_location"),
                            "path": decode_polyline(encoded_points) if encoded_points else [],
                            "steps": [map_direction_step(step) for step in steps],
                        }
                    )
        except Exception as exc:  # pragma: no cover - depends on upstream API/project config
            failure_reasons.append(f"Directions API request failed: {exc}")

    if not routes:
        detail = "Transit directions could not be loaded from Google."
        if failure_reasons:
            detail = f"{detail} {' | '.join(failure_reasons)}"
        raise HTTPException(status_code=400, detail=detail)

    return {"routes": routes}


@app.post("/auth/admin/code")
def validate_admin_code(payload: AdminCodeRequest):
    return {"valid": verify_admin_code(payload.code)}


@app.post("/auth/admin/login")
def admin_login(payload: LoginRequest):
    admin = authenticate_admin(payload.email, payload.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"success": True, "admin": admin}


@app.post("/auth/user/login")
def user_login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user credentials")
    return {"success": True, "user": user}


@app.post("/auth/user/register")
def user_register(payload: RegisterRequest):
    result = register_user(payload.email, payload.password, payload.name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/users")
def list_users():
    return {"users": get_all_users()}


@app.get("/admins")
def list_admins():
    return {"admins": get_all_admins()}


@app.get("/parking/nearest")
def get_nearest_parking(
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 1,
    address: str | None = None,
):
    """Get nearest available parking spots for given coordinates"""
    try:
        if not GOOGLE_MAPS_API_KEY:
            raise HTTPException(status_code=500, detail="Google Maps API key is not configured")

        if address:
            lat, lng = geocode_google_address(address)

        if lat is None or lng is None:
            raise HTTPException(status_code=400, detail="Provide either address or both lat/lng coordinates")

        nearby_spots = get_nearby_parking_spots(lat, lng, radius)
        return NearbyParkingResponse(
            spots=[ParkingSpot(**spot) for spot in nearby_spots],
            count=len(nearby_spots)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching parking spots: {str(e)}")
