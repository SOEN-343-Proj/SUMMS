from __future__ import annotations

from ..transit_adapters import (
    GoogleApiAdapter,
    GoogleDirectionsApiTransitAdapter,
    GoogleRoutesApiTransitAdapter,
    TransitDirectionsServiceAdapter,
)
from .parking_model import get_google_maps_api_key


google_api_adapter = GoogleApiAdapter(get_google_maps_api_key())
transit_directions_adapter = TransitDirectionsServiceAdapter(
    [
        ("Routes API adapter", GoogleRoutesApiTransitAdapter(google_api_adapter, get_google_maps_api_key())),
        ("Directions API adapter", GoogleDirectionsApiTransitAdapter(google_api_adapter, get_google_maps_api_key())),
    ]
)


def get_transit_routes(origin: str, destination: str):
    return transit_directions_adapter.fetch_routes(origin, destination)
