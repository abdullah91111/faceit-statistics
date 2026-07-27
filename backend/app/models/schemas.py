from typing import Literal

from pydantic import BaseModel, Field

RoleName = Literal["Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler"]


class PlayerStats(BaseModel):
    kd_ratio: float = Field(ge=0, le=5)
    kpr: float = Field(default=0.0, ge=0, le=2)
    adr: float = Field(ge=0, le=200)
    headshot_percent: float = Field(ge=0, le=100)
    opening_kill_rate: float = Field(ge=0, le=1)
    entry_success_rate: float = Field(default=0.0, ge=0, le=1)
    total_entry_count: int = Field(default=0, ge=0)
    total_entry_wins: int = Field(default=0, ge=0)
    assists_per_round: float = Field(ge=0, le=2)
    survival_rate: float = Field(ge=0, le=1)
    clutch_rate: float = Field(default=0.0, ge=0, le=1)
    clutch_1v1_win_rate: float = Field(default=0.0, ge=0, le=1)
    clutch_1v2_win_rate: float = Field(default=0.0, ge=0, le=1)
    sniper_kill_rate: float = Field(default=0.0, ge=0, le=1)
    sniper_kills_per_round: float = Field(default=0.0, ge=0, le=1)
    total_sniper_kills: int = Field(default=0, ge=0)
    flashes_per_round: float = Field(default=0.0, ge=0, le=2)
    enemies_flashed_per_round: float = Field(default=0.0, ge=0, le=2)
    flash_success_rate: float = Field(default=0.0, ge=0, le=1)
    utility_damage_per_round: float = Field(default=0.0, ge=0, le=200)
    utility_usage_per_round: float = Field(default=0.0, ge=0, le=2)
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
    score_breakdown: dict[RoleName, float]


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
    firepower_score: float = Field(ge=0, le=10)
    role_balance_score: float = Field(ge=0, le=10)
    form_score: float = Field(ge=0, le=10)
    utility_score: float = Field(ge=0, le=10)
    clutch_score: float = Field(ge=0, le=10)
    strengths: list[str]
    risks: list[str]
    recommendations: list[str]


class WinProbabilityResponse(BaseModel):
    friendly_percent: int = Field(ge=0, le=100)
    enemy_percent: int = Field(ge=0, le=100)
    confidence: Literal["low", "medium", "high"]
    reasons: list[str]


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
    win_probability: WinProbabilityResponse


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


class MatchSummaryRequest(BaseModel):
    match_id: str | None = None
    team_names: list[str] = Field(default_factory=list, max_length=2)
    analysis: MatchAnalysisResponse


class MatchSummaryResponse(BaseModel):
    summary: str
    generated_by: str
    configured: bool
