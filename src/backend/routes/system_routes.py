from __future__ import annotations

from fastapi import APIRouter


router = APIRouter()


@router.get("/")
def root():
    return {"message": "CityFlow API backend is running"}


@router.get("/health")
def health_check():
    return {"status": "ok"}
