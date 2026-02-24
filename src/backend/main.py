from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import math
import os
import time
from typing import Any
from urllib.parse import quote_plus
from urllib.request import urlopen
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
