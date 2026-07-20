import hashlib

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.models.schemas import MapPerformance, MatchAnalysisRequest, MatchRosterAnalysisResponse, MatchRosterTeam, MatchTeam, Player, PlayerStats
from app.services.team_analysis import analyze_match

FACEIT_BASE_URL = "https://open.faceit.com/data/v4"
DEMO_PLAYERS = {"mirage_mind", "tradecraft", "flashpoint", "late_lurk", "site_lock", "sharp_lane", "anchorbyte", "scopefield", "popflash", "underpass"}


class FaceitClient:
    def __init__(self) -> None:
        self.api_key = settings.faceit_api_key

    async def get_player(self, player_id_or_nickname: str) -> Player:
        if not self.api_key or player_id_or_nickname in DEMO_PLAYERS or player_id_or_nickname.startswith("demo_"):
            return demo_player(player_id_or_nickname)

        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {"nickname": player_id_or_nickname, "game": "cs2"}
        async with httpx.AsyncClient(base_url=FACEIT_BASE_URL, headers=headers, timeout=15) as client:
            player_response = await client.get("/players", params=params)
            if player_response.status_code == 404:
                player_response = await client.get(f"/players/{player_id_or_nickname}")
            if player_response.status_code >= 400:
                raise HTTPException(status_code=player_response.status_code, detail="FACEIT player lookup failed")

            player_payload = player_response.json()
            player_id = player_payload.get("player_id", player_id_or_nickname)
            stats_response = await client.get(f"/players/{player_id}/stats/cs2")
            stats_payload = stats_response.json() if stats_response.status_code < 400 else {}

        return normalize_faceit_player(player_payload, stats_payload)

    async def get_match(self, match_id: str) -> dict:
        if match_id.startswith("demo"):
            return demo_match_payload(match_id)

        if not self.api_key:
            return {"match_id": match_id, "mode": "demo", "message": "Set FACEIT_API_KEY to fetch live matches."}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(base_url=FACEIT_BASE_URL, headers=headers, timeout=15) as client:
            response = await client.get(f"/matches/{match_id}")
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail="FACEIT match lookup failed")
            return response.json()

    async def analyze_match_by_id(self, match_id_or_url: str) -> MatchRosterAnalysisResponse:
        match_id = extract_match_id(match_id_or_url)
        match_payload = await self.get_match(match_id)
        teams_payload = match_payload.get("teams", {})
        if len(teams_payload) < 2:
            raise HTTPException(status_code=422, detail="FACEIT match does not contain two team rosters yet")

        teams: list[MatchRosterTeam] = []
        for faction_id, team_payload in teams_payload.items():
            roster = team_payload.get("roster") or []
            players: list[Player] = []
            for roster_player in roster[:5]:
                player_ref = roster_player.get("player_id") or roster_player.get("nickname")
                if not player_ref:
                    continue
                try:
                    player = await self.get_player(player_ref)
                except HTTPException:
                    player = player_from_roster(roster_player)
                players.append(player)

            if players:
                teams.append(
                    MatchRosterTeam(
                        faction_id=faction_id,
                        name=team_payload.get("name") or faction_id,
                        players=players,
                    )
                )

        if len(teams) < 2:
            raise HTTPException(status_code=422, detail="Could not resolve two playable rosters from the FACEIT match")

        analysis = analyze_match(
            MatchAnalysisRequest(
                friendly_team=MatchTeam(name=teams[0].name, players=teams[0].players),
                enemy_team=MatchTeam(name=teams[1].name, players=teams[1].players),
            )
        )
        return MatchRosterAnalysisResponse(
            match_id=match_payload.get("match_id", match_id),
            status=match_payload.get("status"),
            faceit_url=match_payload.get("faceit_url"),
            teams=teams[:2],
            analysis=analysis,
        )


def normalize_faceit_player(player_payload: dict, stats_payload: dict) -> Player:
    lifetime = stats_payload.get("lifetime", {})
    segments = stats_payload.get("segments", [])

    def as_float(key: str, default: float) -> float:
        raw = lifetime.get(key, default)
        try:
            return float(str(raw).replace("%", ""))
        except (TypeError, ValueError):
            return default

    maps = [
        MapPerformance(
            map_name=segment.get("label", "Unknown"),
            win_rate=min(as_segment_float(segment, "Win Rate %", 50) / 100, 1),
            matches=int(float(segment.get("stats", {}).get("Matches", 0) or 0)),
        )
        for segment in segments
        if segment.get("type") == "Map"
    ]

    kd = as_float("Average K/D Ratio", 1.0)
    adr = as_float("ADR", as_float("Average Damage", 72))
    hs = as_float("Average Headshots %", 42)
    win_rate = as_float("Win Rate %", 50) / 100

    stats = PlayerStats(
        kd_ratio=kd,
        adr=adr,
        headshot_percent=hs,
        opening_kill_rate=min(as_float("Entry Rate", 11) / 100, 1),
        assists_per_round=min(as_float("Average Assists", 4) / 24, 2),
        survival_rate=min(0.32 + kd * 0.08, 0.7),
        clutch_rate=min(as_float("Clutch Success Rate", 8) / 100, 1),
        recent_win_rate=min(win_rate, 1),
        matches_played=int(as_float("Matches", 0)),
    )

    games = player_payload.get("games", {})
    cs2 = games.get("cs2") or games.get("csgo") or {}
    return Player(
        id=player_payload.get("player_id", player_payload.get("nickname", "unknown")),
        nickname=player_payload.get("nickname", "Unknown"),
        country=player_payload.get("country"),
        skill_level=cs2.get("skill_level"),
        elo=cs2.get("faceit_elo"),
        stats=stats,
        maps=maps[:7],
    )


def as_segment_float(segment: dict, key: str, default: float) -> float:
    try:
        return float(str(segment.get("stats", {}).get(key, default)).replace("%", ""))
    except (TypeError, ValueError):
        return default


def extract_match_id(match_id_or_url: str) -> str:
    value = match_id_or_url.strip().rstrip("/")
    if "/" not in value:
        return value
    return value.split("/")[-1]


def player_from_roster(roster_player: dict) -> Player:
    return Player(
        id=roster_player.get("player_id", roster_player.get("nickname", "unknown")),
        nickname=roster_player.get("nickname", "Unknown"),
        skill_level=roster_player.get("game_skill_level"),
        stats=PlayerStats(
            kd_ratio=1.0,
            adr=72,
            headshot_percent=42,
            opening_kill_rate=0.1,
            assists_per_round=0.14,
            survival_rate=0.4,
            clutch_rate=0.08,
            recent_win_rate=0.5,
            matches_played=0,
        ),
    )


def demo_match_payload(match_id: str) -> dict:
    def roster(names: list[str]) -> list[dict]:
        return [
            {
                "nickname": name,
                "player_id": name,
                "game_skill_level": 8 + index % 3,
                "game_player_name": name,
            }
            for index, name in enumerate(names)
        ]

    return {
        "match_id": match_id,
        "status": "demo",
        "faceit_url": f"https://www.faceit.com/en/cs2/room/{match_id}",
        "teams": {
            "faction1": {
                "faction_id": "faction1",
                "name": "Demo Alpha",
                "roster": roster(["mirage_mind", "tradecraft", "flashpoint", "late_lurk", "site_lock"]),
            },
            "faction2": {
                "faction_id": "faction2",
                "name": "Demo Bravo",
                "roster": roster(["sharp_lane", "anchorbyte", "scopefield", "popflash", "underpass"]),
            },
        },
    }


def demo_player(seed: str) -> Player:
    names = ["mirage_mind", "tradecraft", "flashpoint", "late_lurk", "site_lock"]
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(names)
    return Player(
        id=seed,
        nickname=seed if seed else names[idx],
        country="EU",
        skill_level=8 + (idx % 3),
        elo=1850 + idx * 125,
        stats=PlayerStats(
            kd_ratio=[1.18, 1.05, 0.98, 1.22, 1.1][idx],
            adr=[86, 74, 67, 79, 72][idx],
            headshot_percent=[51, 43, 38, 47, 45][idx],
            opening_kill_rate=[0.19, 0.11, 0.08, 0.13, 0.1][idx],
            assists_per_round=[0.11, 0.18, 0.23, 0.12, 0.15][idx],
            survival_rate=[0.34, 0.41, 0.44, 0.48, 0.46][idx],
            clutch_rate=[0.09, 0.11, 0.08, 0.17, 0.14][idx],
            recent_win_rate=[0.62, 0.55, 0.49, 0.58, 0.53][idx],
            matches_played=120 + idx * 31,
        ),
        maps=[
            MapPerformance(map_name="Mirage", win_rate=0.58 + idx * 0.02, matches=24 + idx),
            MapPerformance(map_name="Ancient", win_rate=0.52, matches=16),
            MapPerformance(map_name="Nuke", win_rate=0.48 + idx * 0.03, matches=12),
        ],
    )
