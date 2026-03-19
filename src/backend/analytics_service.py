import json
import os
from typing import Any
from .observer import event_manager, Observer

ANALYTICS_FILE = "analytics_data.json"


class AnalyticsService(Observer):
    def __init__(self):
        self.total_requests = 0
        self.parking_searches = 0
        self.admin_logins = 0
        self.user_logins = 0
        self.uber_bixi_searches = 0
        self.service_usage: dict[str, int] = {}
        self.load()

    def load(self) -> None:
        if not os.path.exists(ANALYTICS_FILE):
            self.save()
            return

        try:
            with open(ANALYTICS_FILE, "r", encoding="utf-8") as file:
                data = json.load(file)

            self.total_requests = data.get("total_requests", 0)
            self.parking_searches = data.get("parking_searches", 0)
            self.admin_logins = data.get("admin_logins", 0)
            self.user_logins = data.get("user_logins", 0)
            self.uber_bixi_searches = data.get("uber_bixi_searches", 0)
            self.service_usage = data.get("service_usage", {})
        except Exception:
            self.total_requests = 0
            self.parking_searches = 0
            self.admin_logins = 0
            self.user_logins = 0
            self.uber_bixi_searches = 0
            self.service_usage = {}
            self.save()

    def save(self) -> None:
        data = {
            "total_requests": self.total_requests,
            "parking_searches": self.parking_searches,
            "admin_logins": self.admin_logins,
            "user_logins": self.user_logins,
            "uber_bixi_searches": self.uber_bixi_searches,
            "service_usage": self.service_usage,
        }

        with open(ANALYTICS_FILE, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)

    def update(self, event_name: str, data: dict[str, Any] | None = None) -> None:
        if event_name == "request_received":
            self.total_requests += 1
        elif event_name == "admin_login":
            self.admin_logins += 1
            self._increment_service("admin_login")
        elif event_name == "user_login":
            self.user_logins += 1
            self._increment_service("user_login")
        elif event_name == "parking_search":
            self.parking_searches += 1
            self._increment_service("parking")
        elif event_name == "uber_bixi_search":
            self.uber_bixi_searches += 1
            self._increment_service("uber_bixi")

        self.save()

    def _increment_service(self, name: str) -> None:
        if name not in self.service_usage:
            self.service_usage[name] = 0

        self.service_usage[name] += 1

    def get_stats(self) -> dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "parking_searches": self.parking_searches,
            "admin_logins": self.admin_logins,
            "user_logins": self.user_logins,
            "uber_bixi_searches": self.uber_bixi_searches,
            "service_usage": self.service_usage,
        }


analytics = AnalyticsService()

event_manager.subscribe("request_received", analytics)
event_manager.subscribe("admin_login", analytics)
event_manager.subscribe("user_login", analytics)
event_manager.subscribe("parking_search", analytics)
event_manager.subscribe("uber_bixi_search", analytics)