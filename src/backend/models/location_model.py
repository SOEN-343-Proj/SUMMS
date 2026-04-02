from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from fastapi import HTTPException


PHOTON_SEARCH_URL = "https://photon.komoot.io/api/"
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"
CACHE_TTL_SECONDS = 3600
CACHE_MAX_ENTRIES = 500
MONTREAL_CENTER_LAT = 45.5017
MONTREAL_CENTER_LNG = -73.5673
MONTREAL_BOUNDS = {
    "min_lat": 45.39,
    "max_lat": 45.72,
    "min_lng": -73.95,
    "max_lng": -73.4,
}

SEARCH_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
GEOCODE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
REVERSE_CACHE: dict[str, tuple[float, str]] = {}


def _normalize_query(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def _get_cache_value(cache: dict[str, tuple[float, Any]], key: str) -> Any | None:
    item = cache.get(key)
    if not item:
        return None

    created_at, value = item
    if (time.time() - created_at) > CACHE_TTL_SECONDS:
        del cache[key]
        return None

    return value


def _set_cache_value(cache: dict[str, tuple[float, Any]], key: str, value: Any) -> None:
    if len(cache) >= CACHE_MAX_ENTRIES:
        oldest_key = min(cache, key=lambda item_key: cache[item_key][0])
        del cache[oldest_key]

    cache[key] = (time.time(), value)


def _fetch_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "CityFlow/1.0",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Address service request failed: {detail or exc.reason}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="Address service is unavailable right now.") from exc


def _is_in_montreal_area(lat: float, lng: float) -> bool:
    return (
        MONTREAL_BOUNDS["min_lat"] <= lat <= MONTREAL_BOUNDS["max_lat"]
        and MONTREAL_BOUNDS["min_lng"] <= lng <= MONTREAL_BOUNDS["max_lng"]
    )


def _build_display_name(properties: dict[str, Any]) -> str:
    housenumber = str(properties.get("housenumber", "")).strip()
    street = str(properties.get("street", "")).strip()
    name = str(properties.get("name", "")).strip()
    district = str(properties.get("district", "")).strip()
    locality = str(properties.get("locality", "")).strip()
    city = str(properties.get("city", "")).strip()
    state = str(properties.get("state", "")).strip()
    postcode = str(properties.get("postcode", "")).strip()
    country = str(properties.get("country", "")).strip()

    street_line = " ".join(part for part in [housenumber, street] if part).strip()
    primary = name or street_line or city or country or "Unknown address"

    parts: list[str] = [primary]
    if name and street_line and street_line.lower() != name.lower():
        parts.append(street_line)

    for value in [district, locality, city, state, postcode, country]:
        if value and value.lower() not in {part.lower() for part in parts}:
            parts.append(value)

    return ", ".join(parts)


def _normalize_feature(feature: dict[str, Any]) -> dict[str, Any] | None:
    geometry = feature.get("geometry", {})
    coordinates = geometry.get("coordinates", [])
    if len(coordinates) != 2:
        return None

    lon, lat = coordinates
    try:
        lat_value = float(lat)
        lon_value = float(lon)
    except (TypeError, ValueError):
        return None

    properties = feature.get("properties", {})
    place_id = f"{properties.get('osm_type', 'photon')}-{properties.get('osm_id', '')}".strip("-")

    return {
        "place_id": place_id or f"photon-{lat_value}-{lon_value}",
        "lat": lat_value,
        "lon": lon_value,
        "display_name": _build_display_name(properties),
    }


def _dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique_results: list[dict[str, Any]] = []

    for result in results:
        key = f"{result['lat']:.6f}:{result['lon']:.6f}:{result['display_name'].lower()}"
        if key in seen:
            continue

        seen.add(key)
        unique_results.append(result)

    return unique_results


def search_address_suggestions(query: str, limit: int = 8, bounded: bool = True) -> list[dict[str, Any]]:
    normalized_query = _normalize_query(query)
    if len(normalized_query) < 3:
        return []

    safe_limit = max(1, min(limit, 12))
    cache_key = f"search:{normalized_query.lower()}:{safe_limit}:{int(bounded)}"
    cached_results = _get_cache_value(SEARCH_CACHE, cache_key)
    if cached_results is not None:
        return cached_results

    upstream_limit = min(max(safe_limit * 2, safe_limit), 20)
    search_url = (
        f"{PHOTON_SEARCH_URL}?q={quote_plus(normalized_query)}"
        f"&limit={upstream_limit}"
        "&lang=en"
        f"&lat={MONTREAL_CENTER_LAT}"
        f"&lon={MONTREAL_CENTER_LNG}"
    )
    payload = _fetch_json(search_url)
    features = payload.get("features", [])

    normalized_results = [
        result
        for feature in features
        if (result := _normalize_feature(feature)) is not None
    ]

    if bounded:
        montreal_results = [
            result for result in normalized_results if _is_in_montreal_area(result["lat"], result["lon"])
        ]
        if montreal_results:
            normalized_results = montreal_results

    suggestions = _dedupe_results(normalized_results)[:safe_limit]
    _set_cache_value(SEARCH_CACHE, cache_key, suggestions)
    return suggestions


def geocode_address(address: str) -> dict[str, Any]:
    normalized_address = _normalize_query(address)
    if not normalized_address:
        raise HTTPException(status_code=400, detail="Address is required")

    cache_key = f"geocode:{normalized_address.lower()}"
    cached_result = _get_cache_value(GEOCODE_CACHE, cache_key)
    if cached_result is not None:
        return cached_result

    matches = search_address_suggestions(normalized_address, limit=1, bounded=False)
    if not matches:
        raise HTTPException(status_code=404, detail="Address not found")

    match = matches[0]
    _set_cache_value(GEOCODE_CACHE, cache_key, match)
    return match


def reverse_lookup(lat: float, lng: float) -> str:
    cache_key = f"reverse:{round(lat, 5)}:{round(lng, 5)}"
    cached_value = _get_cache_value(REVERSE_CACHE, cache_key)
    if cached_value is not None:
        return cached_value

    reverse_url = (
        f"{PHOTON_REVERSE_URL}?lat={lat}&lon={lng}"
        "&lang=en"
    )
    payload = _fetch_json(reverse_url)
    features = payload.get("features", [])
    first_match = next(
        (result for feature in features if (result := _normalize_feature(feature)) is not None),
        None,
    )
    if not first_match:
        raise HTTPException(status_code=404, detail="Address not found")

    address = first_match["display_name"]
    _set_cache_value(REVERSE_CACHE, cache_key, address)
    return address
