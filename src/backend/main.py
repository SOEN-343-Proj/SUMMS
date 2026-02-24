from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import math

mapsApiKey = "AIzaSyAOVjtt-TvPi31gZcmeedmc4-cMrq9jO5A"

try:
    from .credentials import (
        authenticate_admin,
        authenticate_user,
        get_all_admins,
        get_all_users,
        register_user,
        verify_admin_code,
    )
except ImportError:
    from credentials import (  # pragma: no cover
        authenticate_admin,
        authenticate_user,
        get_all_admins,
        get_all_users,
        register_user,
        verify_admin_code,
    )


class AdminCodeRequest(BaseModel):
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class ParkingSpot(BaseModel):
    id: int
    lat: float
    lng: float
    name: str
    available: int
    total: int


class NearbyParkingResponse(BaseModel):
    spots: list[ParkingSpot]
    count: int


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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock parking data for Montreal/Laval area
MOCK_PARKING_SPOTS = [
    {"id": 1, "lat": 45.5017, "lng": -73.5673, "name": "Downtown Montreal Garage", "available": 12, "total": 50},
    {"id": 2, "lat": 45.4973, "lng": -73.5724, "name": "Old Port Parking", "available": 3, "total": 30},
    {"id": 3, "lat": 45.5089, "lng": -73.5628, "name": "McGill Lot", "available": 25, "total": 100},
    {"id": 4, "lat": 45.5210, "lng": -73.5834, "name": "Outremont Parking", "available": 18, "total": 40},
    {"id": 5, "lat": 45.6055, "lng": -73.5465, "name": "Laval Downtown", "available": 8, "total": 35},
    {"id": 6, "lat": 45.4210, "lng": -73.4724, "name": "South Shore Lot", "available": 35, "total": 80},
]


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula (in km)"""
    R = 6371  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2 +
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_nearby_parking_spots(lat: float, lng: float, radius_km: float = 5) -> list[dict]:
    """Get parking spots within radius_km of given coordinates, sorted by distance"""
    nearby_spots = []
    
    for spot in MOCK_PARKING_SPOTS:
        distance = calculate_distance(lat, lng, spot["lat"], spot["lng"])
        if distance <= radius_km:
            nearby_spots.append({**spot, "distance": round(distance, 2)})
    
    # Sort by distance
    nearby_spots.sort(key=lambda x: x["distance"])
    return nearby_spots


@app.get("/")
def root():
    return {"message": "CityFlow API backend is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/admin/code")
def validate_admin_code(payload: AdminCodeRequest):
    return {"valid": verify_admin_code(payload.code)}


@app.post("/auth/admin/login")
def admin_login(payload: LoginRequest):
    admin = authenticate_admin(payload.email, payload.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"success": True, "admin": admin}


@app.post("/auth/user/login")
def user_login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user credentials")
    return {"success": True, "user": user}


@app.post("/auth/user/register")
def user_register(payload: RegisterRequest):
    result = register_user(payload.email, payload.password, payload.name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/users")
def list_users():
    return {"users": get_all_users()}


@app.get("/admins")
def list_admins():
    return {"admins": get_all_admins()}


@app.get("/parking/nearest")
def get_nearest_parking(lat: float, lng: float, radius: float = 5):
    """Get nearest available parking spots for given coordinates"""
    try:
        nearby_spots = get_nearby_parking_spots(lat, lng, radius)
        return NearbyParkingResponse(
            spots=[ParkingSpot(**{k: v for k, v in spot.items() if k != "distance"}) for spot in nearby_spots],
            count=len(nearby_spots)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching parking spots: {str(e)}")
