from __future__ import annotations

from ..models import bixi_model


def list_nearby_bixi_stations(lat: float, lng: float, limit: int = 12, radius: float = 3):
    stations = bixi_model.get_nearby_bixi_stations(lat=lat, lng=lng, limit=limit, radius_km=radius)
    return {"stations": stations, "count": len(stations)}


def get_bixi_rental_state(user_email: str, history_limit: int = 5):
    return bixi_model.get_user_bixi_rental_state(user_email, history_limit=history_limit)


def create_bixi_reservation(user_email: str, user_name: str, station_id: str):
    rental = bixi_model.reserve_bixi_bike(
        user_email=user_email,
        user_name=user_name,
        station_id=station_id,
    )
    return {"success": True, "rental": rental}


def pay_bixi_reservation(
    rental_id: str,
    user_email: str,
    payment_method: str = "card",
    payment_details: dict | None = None,
):
    rental = bixi_model.pay_for_bixi_rental(
        rental_id=rental_id,
        user_email=user_email,
        payment_method=payment_method,
        payment_details=payment_details,
    )
    return {"success": True, "rental": rental}


def list_payment_methods():
    return {"methods": bixi_model.get_mock_payment_methods()}


def complete_bixi_return(rental_id: str, user_email: str, return_station_id: str):
    rental = bixi_model.return_bixi_rental(
        rental_id=rental_id,
        user_email=user_email,
        return_station_id=return_station_id,
    )
    return {"success": True, "rental": rental}


def get_bixi_summary():
    return bixi_model.get_bixi_analytics_summary()
