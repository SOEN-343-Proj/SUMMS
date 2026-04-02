from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .observer import event_manager
from .routes.admin_routes import router as admin_router
from .routes.analytics_routes import router as analytics_router
from .routes.auth_routes import router as auth_router
from .routes.bixi_routes import router as bixi_router
from .routes.mobility_routes import router as mobility_router
from .routes.system_routes import router as system_router
from .routes.vehicle_routes import router as vehicle_router


app = FastAPI(
    title="CityFlow Backend API",
    description="FastAPI backend for CityFlow urban mobility management.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(system_router)
app.include_router(auth_router)
app.include_router(mobility_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(bixi_router)
app.include_router(vehicle_router)

@app.middleware("http")
async def track_requests(request, call_next):
    event_manager.notify("request_received")
    response = await call_next(request)
    return response
