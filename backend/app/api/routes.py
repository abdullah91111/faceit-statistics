from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import (
    MatchAnalysisRequest,
    MatchAnalysisResponse,
    MatchRosterAnalysisResponse,
    Player,
    TeamAnalysisRequest,
    TeamCompatibilityResponse,
)
from app.services.faceit_client import FaceitClient
from app.services.team_analysis import analyze_match, analyze_team

router = APIRouter()
faceit = FaceitClient()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/config/status")
async def config_status() -> dict[str, bool]:
    return {
        "faceit_api_key": settings.has_faceit_api_key,
        "database_url": settings.has_database_url,
        "database_required_for_mvp": False,
        "llm_enabled": False,
    }


@router.get("/player/{player_id}", response_model=Player)
async def get_player(player_id: str) -> Player:
    return await faceit.get_player(player_id)


@router.get("/match/{match_id}/analysis", response_model=MatchRosterAnalysisResponse)
async def get_match_analysis(match_id: str) -> MatchRosterAnalysisResponse:
    return await faceit.analyze_match_by_id(match_id)


@router.get("/match/{match_id}")
async def get_match(match_id: str) -> dict:
    return await faceit.get_match(match_id)


@router.post("/analyze/team", response_model=TeamCompatibilityResponse)
async def post_team_analysis(payload: TeamAnalysisRequest) -> TeamCompatibilityResponse:
    return analyze_team(payload.players)


@router.post("/analyze/match", response_model=MatchAnalysisResponse)
async def post_match_analysis(payload: MatchAnalysisRequest) -> MatchAnalysisResponse:
    return analyze_match(payload)
