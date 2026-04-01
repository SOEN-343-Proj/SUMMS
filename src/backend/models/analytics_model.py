from __future__ import annotations

from ..analytics_service import analytics


ALLOWED_FRONTEND_EVENTS = {
    "feature_opened",
    "bixi_reserved",
    "bixi_payment",
    "bixi_returned",
    "vehicle_rented",
    "vehicle_returned",
    "vehicle_listed",
    "transit_route_searched",
}


def get_stats():
    return analytics.get_stats()


def is_allowed_frontend_event(event_name: str) -> bool:
    return event_name in ALLOWED_FRONTEND_EVENTS
