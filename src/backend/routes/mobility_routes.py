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


router = APIRouter()


@router.get("/config/google-maps-key")
def get_google_maps_key():
    return mobility_controller.get_google_maps_key()


@router.get("/maps/reverse-geocode")
def reverse_geocode(lat: float, lng: float):
    return mobility_controller.reverse_geocode(lat, lng)


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
