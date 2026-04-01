from __future__ import annotations

from fastapi import HTTPException

from ..models import parking_model, transit_model
from ..observer import event_manager


def get_google_maps_key():
    api_key = parking_model.get_google_maps_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")
    return {"apiKey": api_key}


def reverse_geocode(lat: float, lng: float):
    if not parking_model.get_google_maps_api_key():
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")
    return {"address": parking_model.reverse_geocode(lat, lng)}


def get_transit_directions(origin: str, destination: str):
    if not parking_model.get_google_maps_api_key():
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")
    routes = transit_model.get_transit_routes(origin, destination)
    return {"routes": routes}


def get_nearest_parking(
    *,
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 1,
    address: str | None = None,
):
    try:
        if not parking_model.get_google_maps_api_key():
            raise HTTPException(status_code=500, detail="Google Maps API key is not configured")

        if address:
            lat, lng = parking_model.geocode_address(address)

        if lat is None or lng is None:
            raise HTTPException(status_code=400, detail="Provide either address or both lat/lng coordinates")

        nearby_spots = parking_model.get_nearby_parking_spots(lat, lng, radius)
        event_manager.notify("parking_search", {"lat": lat, "lng": lng, "radius": radius})
        return {"spots": nearby_spots, "count": len(nearby_spots)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error fetching parking spots: {str(exc)}") from exc
