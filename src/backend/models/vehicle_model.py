from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from fastapi import HTTPException

from ..Sprint1Implementation.vehicle_rental import (
    VehicleInUseError,
    add_marketplace_vehicle,
    add_user_vehicle,
    get_available_vehicles,
    get_user_marketplace_listings,
    get_user_vehicles,
    remove_vehicle,
    rent_vehicle,
    return_rented_vehicle,
    update_vehicle,
    update_marketplace_vehicle,
)


VPIC_VIN_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{vin}?format=json"
VIN_CACHE_TTL_SECONDS = 86400
VIN_CACHE_MAX_ENTRIES = 300
VIN_DECODE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
INVALID_VPIC_VALUES = {
    "",
    "0",
    "Not Applicable",
    "Not Available",
    "None",
    "NULL",
    "null",
}


def _get_cache_value(cache: dict[str, tuple[float, Any]], key: str) -> Any | None:
    item = cache.get(key)
    if not item:
        return None

    created_at, value = item
    if (time.time() - created_at) > VIN_CACHE_TTL_SECONDS:
        del cache[key]
        return None

    return value


def _set_cache_value(cache: dict[str, tuple[float, Any]], key: str, value: Any) -> None:
    if len(cache) >= VIN_CACHE_MAX_ENTRIES:
        oldest_key = min(cache, key=lambda item_key: cache[item_key][0])
        del cache[oldest_key]

    cache[key] = (time.time(), value)


def _normalize_vin(vin: str) -> str:
    normalized_vin = "".join(character for character in str(vin or "").upper() if character.isalnum())
    if len(normalized_vin) != 17:
        raise ValueError("VIN must be 17 letters and numbers.")
    if any(character in {"I", "O", "Q"} for character in normalized_vin):
        raise ValueError("VIN contains invalid characters. Please double-check the VIN and try again.")
    return normalized_vin


def _clean_vpic_value(value: Any) -> str | None:
    normalized = str(value or "").strip()
    if not normalized or normalized in INVALID_VPIC_VALUES:
        return None
    if normalized.lower() in {entry.lower() for entry in INVALID_VPIC_VALUES}:
        return None
    return normalized


def _to_positive_int(value: Any) -> int | None:
    try:
        parsed_value = int(float(value))
    except (TypeError, ValueError):
        return None

    return parsed_value if parsed_value > 0 else None


def _infer_marketplace_vehicle_type(vehicle_type: str | None, body_class: str | None) -> str:
    fingerprint = " ".join(part for part in [vehicle_type, body_class] if part).lower()

    if any(term in fingerprint for term in {"ebike", "e-bike", "electric bicycle", "bicycle", "pedalcycle"}):
        return "ebike"
    if "scooter" in fingerprint:
        return "scooter"
    if any(term in fingerprint for term in {"moped", "motorcycle", "motor bike"}):
        return "moped"
    return "car"


def _fetch_vpic_payload(url: str) -> dict[str, Any]:
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
        raise HTTPException(status_code=502, detail=f"VIN lookup request failed: {detail or exc.reason}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="VIN lookup service is unavailable right now.") from exc


def decode_vehicle_vin(vin: str) -> dict[str, Any]:
    normalized_vin = _normalize_vin(vin)
    cached_vehicle = _get_cache_value(VIN_DECODE_CACHE, normalized_vin)
    if cached_vehicle is not None:
        return {
            "vin": normalized_vin,
            "vehicle": dict(cached_vehicle),
            "source": "nhtsa_vpic",
        }

    payload = _fetch_vpic_payload(
        VPIC_VIN_DECODE_URL.format(vin=quote_plus(normalized_vin))
    )
    results = payload.get("Results") or []
    if not results:
        raise HTTPException(status_code=502, detail="VIN lookup returned no results.")

    decoded_result = results[0]
    make = _clean_vpic_value(decoded_result.get("Make"))
    model = _clean_vpic_value(decoded_result.get("Model"))
    model_year = _to_positive_int(decoded_result.get("ModelYear"))
    fuel_type = _clean_vpic_value(decoded_result.get("FuelTypePrimary"))
    transmission = _clean_vpic_value(decoded_result.get("TransmissionStyle"))
    seats = _to_positive_int(decoded_result.get("Seats"))
    raw_vehicle_type = _clean_vpic_value(decoded_result.get("VehicleType"))
    body_class = _clean_vpic_value(decoded_result.get("BodyClass"))
    vehicle_type = _infer_marketplace_vehicle_type(raw_vehicle_type, body_class)

    if not any([make, model, model_year]):
        error_text = _clean_vpic_value(decoded_result.get("ErrorText"))
        raise ValueError(error_text or "VIN could not be decoded. Please check the VIN and try again.")

    decoded_vehicle = {
        "vehicle_type": vehicle_type,
        "make": make,
        "model": model,
        "year": model_year,
        "fuel_type": fuel_type,
        "transmission": transmission,
        "seats": seats,
    }
    normalized_vehicle = {
        key: value
        for key, value in decoded_vehicle.items()
        if value not in {None, ""}
    }

    _set_cache_value(VIN_DECODE_CACHE, normalized_vin, normalized_vehicle)

    return {
        "vin": normalized_vin,
        "vehicle": normalized_vehicle,
        "source": "nhtsa_vpic",
    }


__all__ = [
    "VehicleInUseError",
    "add_marketplace_vehicle",
    "add_user_vehicle",
    "decode_vehicle_vin",
    "get_available_vehicles",
    "get_user_marketplace_listings",
    "get_user_vehicles",
    "remove_vehicle",
    "rent_vehicle",
    "return_rented_vehicle",
    "update_vehicle",
    "update_marketplace_vehicle",
]
