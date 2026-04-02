from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..controllers import mobility_controller


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


class LocationSuggestion(BaseModel):
    place_id: str
    lat: float
    lon: float
    display_name: str


class LocationSuggestionsResponse(BaseModel):
    suggestions: list[LocationSuggestion]


class GeocodeResponse(BaseModel):
    location: LocationSuggestion


router = APIRouter()


@router.get("/config/google-maps-key")
def get_google_maps_key():
    return mobility_controller.get_google_maps_key()


@router.get("/maps/reverse-geocode")
def reverse_geocode(lat: float, lng: float):
    return mobility_controller.reverse_geocode(lat, lng)


@router.get("/maps/address-suggestions", response_model=LocationSuggestionsResponse)
def fetch_location_suggestions(query: str, limit: int = 8, bounded: bool = True):
    return mobility_controller.fetch_location_suggestions(query, limit, bounded)


@router.get("/maps/geocode", response_model=GeocodeResponse)
def geocode_location(address: str):
    return mobility_controller.geocode_location(address)


@router.get("/transit/directions")
def get_transit_directions(origin: str, destination: str):
    return mobility_controller.get_transit_directions(origin, destination)


@router.get("/parking/nearest", response_model=NearbyParkingResponse)
def get_nearest_parking(
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 1,
    address: str | None = None,
):
    result = mobility_controller.get_nearest_parking(
        lat=lat,
        lng=lng,
        radius=radius,
        address=address,
    )
    return NearbyParkingResponse(
        spots=[ParkingSpot(**spot) for spot in result["spots"]],
        count=result["count"],
    )
