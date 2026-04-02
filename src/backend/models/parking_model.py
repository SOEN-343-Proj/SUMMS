from __future__ import annotations

import math
import os
import time
from typing import Any

from fastapi import HTTPException

from ..transit_adapters import GoogleApiAdapter, GoogleGeocodingAdapter


DEFAULT_GOOGLE_MAPS_API_KEY = "AIzaSyAOVjtt-TvPi31gZcmeedmc4-cMrq9jO5A"
CACHE_TTL_NEARBY_SECONDS = 900
CACHE_TTL_GEOCODE_SECONDS = 86400
CACHE_MAX_ENTRIES = 500

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", DEFAULT_GOOGLE_MAPS_API_KEY)
NEARBY_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
GEOCODE_CACHE: dict[str, tuple[float, tuple[float, float] | str]] = {}

google_api_adapter = GoogleApiAdapter(GOOGLE_MAPS_API_KEY)
google_geocoding_adapter = GoogleGeocodingAdapter(
    google_api_adapter,
    GOOGLE_MAPS_API_KEY,
    GEOCODE_CACHE,
    CACHE_TTL_GEOCODE_SECONDS,
    CACHE_MAX_ENTRIES,
)


def get_google_maps_api_key() -> str:
    return GOOGLE_MAPS_API_KEY


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


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


def geocode_address(address: str) -> tuple[float, float]:
    return google_geocoding_adapter.geocode_address(address)


def reverse_geocode(lat: float, lng: float) -> str:
    return google_geocoding_adapter.reverse_geocode(lat, lng)


def get_nearby_parking_spots(lat: float, lng: float, radius_km: float = 1) -> list[dict[str, Any]]:
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
    payload = google_api_adapter.fetch_json(nearby_url)

    if payload.get("status") not in {"OK", "ZERO_RESULTS"}:
        raise HTTPException(status_code=400, detail=f"Google Places error: {payload.get('status', 'UNKNOWN_ERROR')}")

    spots: list[dict[str, Any]] = []
    for place in payload.get("results", []):
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
