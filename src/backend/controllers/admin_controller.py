from __future__ import annotations

from ..models import analytics_model


def get_admin_analytics():
    return analytics_model.get_stats()
