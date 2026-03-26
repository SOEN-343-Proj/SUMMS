import json
import os
from datetime import datetime, timezone
from typing import Any
from .observer import event_manager, Observer

ANALYTICS_FILE = "analytics_data.json"
MAX_EVENT_LOG = 200


class AnalyticsService(Observer):
    def __init__(self):
        self.total_requests = 0
        self.parking_searches = 0
        self.admin_logins = 0
        self.user_logins = 0
        self.uber_bixi_searches = 0
        self.service_usage: dict[str, int] = {}
        self.event_log: list[dict[str, Any]] = []
        self.hourly_buckets: dict[str, int] = {}
        self.load()

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _hour_key(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00+00:00")

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
            self.event_log = data.get("event_log", [])
            self.hourly_buckets = data.get("hourly_buckets", {})
        except Exception:
            self.total_requests = 0
            self.parking_searches = 0
            self.admin_logins = 0
            self.user_logins = 0
            self.uber_bixi_searches = 0
            self.service_usage = {}
            self.event_log = []
            self.hourly_buckets = {}
            self.save()

    def save(self) -> None:
        data = {
            "total_requests": self.total_requests,
            "parking_searches": self.parking_searches,
            "admin_logins": self.admin_logins,
            "user_logins": self.user_logins,
            "uber_bixi_searches": self.uber_bixi_searches,
            "service_usage": self.service_usage,
            "event_log": self.event_log[-MAX_EVENT_LOG:],
            "hourly_buckets": self.hourly_buckets,
        }

        with open(ANALYTICS_FILE, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)

    def _log_event(self, event_name: str, data: dict[str, Any] | None = None) -> None:
        entry: dict[str, Any] = {
            "timestamp": self._now_iso(),
            "event": event_name,
        }
        if data:
            entry["data"] = data

        self.event_log.append(entry)
        if len(self.event_log) > MAX_EVENT_LOG:
            self.event_log = self.event_log[-MAX_EVENT_LOG:]

        hour_key = self._hour_key()
        self.hourly_buckets[hour_key] = self.hourly_buckets.get(hour_key, 0) + 1

        # Prune hourly buckets older than 7 days (168 hours)
        if len(self.hourly_buckets) > 168:
            sorted_keys = sorted(self.hourly_buckets.keys())
            for old_key in sorted_keys[:-168]:
                del self.hourly_buckets[old_key]

    def update(self, event_name: str, data: dict[str, Any] | None = None) -> None:
        if event_name == "request_received":
            self.total_requests += 1
            # Don't log every HTTP request to the event feed
            hour_key = self._hour_key()
            self.hourly_buckets[hour_key] = self.hourly_buckets.get(hour_key, 0) + 1
        elif event_name == "admin_login":
            self.admin_logins += 1
            self._increment_service("admin_login")
            self._log_event("admin_login", data)
        elif event_name == "user_login":
            self.user_logins += 1
            self._increment_service("user_login")
            self._log_event("user_login", data)
        elif event_name == "parking_search":
            self.parking_searches += 1
            self._increment_service("parking")
            self._log_event("parking_search", data)
        elif event_name == "uber_bixi_search":
            self.uber_bixi_searches += 1
            self._increment_service("uber_bixi")
            self._log_event("uber_bixi_search", data)

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
            "event_log": list(reversed(self.event_log)),
            "hourly_buckets": self.hourly_buckets,
        }


analytics = AnalyticsService()

event_manager.subscribe("request_received", analytics)
event_manager.subscribe("admin_login", analytics)
event_manager.subscribe("user_login", analytics)
event_manager.subscribe("parking_search", analytics)
event_manager.subscribe("uber_bixi_search", analytics)