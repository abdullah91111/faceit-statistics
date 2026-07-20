from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title="FACEIT CS2 AI Team Analyzer",
    description="Analyze FACEIT CS2 players, teams, enemies, and match plans.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def read_root() -> dict[str, str]:
    return {"message": "FACEIT CS2 AI Team Analyzer API"}
