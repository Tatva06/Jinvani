"""
Jinvani · FastAPI Backend
Run with: uvicorn main:app --reload --port 8000

Required env vars (in .env):
    SUPABASE_URL
    SUPABASE_KEY
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import AsyncClient, acreate_client

from routers import feed, bookmarks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("jinvani")

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]


class AppState:
    supabase: AsyncClient


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Connecting to Supabase at %s", SUPABASE_URL)
    state.supabase = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase client ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Jinvani API",
    description="Backend for the Jinvani trilingual Jain micro-reader.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feed.router,      prefix="/api/v1", tags=["Feed"])
app.include_router(bookmarks.router, prefix="/api/v1", tags=["Bookmarks"])


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "jinvani-api"}
