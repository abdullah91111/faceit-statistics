from typing import Literal

from pydantic import BaseModel, Field

RoleName = Literal["Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler"]


class PlayerStats(BaseModel):
    kd_ratio: float = Field(ge=0, le=5)
    adr: float = Field(ge=0, le=200)
    headshot_percent: float = Field(ge=0, le=100)
    opening_kill_rate: float = Field(ge=0, le=1)
    assists_per_round: float = Field(ge=0, le=2)
    survival_rate: float = Field(ge=0, le=1)
    clutch_rate: float = Field(default=0.0, ge=0, le=1)
    recent_win_rate: float = Field(default=0.5, ge=0, le=1)
    matches_played: int = Field(default=0, ge=0)


class MapPerformance(BaseModel):
    map_name: str
    win_rate: float = Field(ge=0, le=1)
    matches: int = Field(ge=0)


class Player(BaseModel):
    id: str
    nickname: str
    country: str | None = None
    skill_level: int | None = Field(default=None, ge=1, le=10)
    elo: int | None = None
    stats: PlayerStats
    maps: list[MapPerformance] = Field(default_factory=list)


class RoleDetection(BaseModel):
    player_id: str
    nickname: str
    role: RoleName
    confidence: float = Field(ge=0, le=1)
    signals: list[str]


class TeamAnalysisRequest(BaseModel):
    players: list[Player] = Field(min_length=1, max_length=5)


class RoleCoverage(BaseModel):
    role: RoleName
    count: int


class TeamCompatibilityResponse(BaseModel):
    score: float = Field(ge=0, le=10)
    grade: Literal["S", "A", "B", "C", "D"]
    roles: list[RoleDetection]
    coverage: list[RoleCoverage]
    strengths: list[str]
    risks: list[str]
    recommendations: list[str]


class MatchTeam(BaseModel):
    name: str
    players: list[Player] = Field(min_length=1, max_length=5)


class MatchAnalysisRequest(BaseModel):
    friendly_team: MatchTeam
    enemy_team: MatchTeam


class EnemyScoutingResponse(BaseModel):
    best_maps: list[MapPerformance]
    strong_players: list[str]
    weak_players: list[str]
    playstyle_indicators: list[str]
    risks: list[str]


class MatchAnalysisResponse(BaseModel):
    friendly: TeamCompatibilityResponse
    enemy: TeamCompatibilityResponse
    scouting: EnemyScoutingResponse


class MatchRosterTeam(BaseModel):
    faction_id: str
    name: str
    players: list[Player]


class MatchRosterAnalysisResponse(BaseModel):
    match_id: str
    status: str | None = None
    faceit_url: str | None = None
    teams: list[MatchRosterTeam]
    analysis: MatchAnalysisResponse
