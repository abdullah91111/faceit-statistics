from fastapi.testclient import TestClient

from main import app
from app.models.schemas import Player, PlayerStats
from app.services.role_detection import detect_role


client = TestClient(app)


def test_config_status() -> None:
    response = client.get("/config/status")
    assert response.status_code == 200
    body = response.json()
    assert body["database_required_for_mvp"] is False
    assert body["llm_enabled"] is False


def test_api_prefix_routes_for_vercel() -> None:
    response = client.get("/api/config/status")
    assert response.status_code == 200
    match = client.get("/api/match/demo-match/analysis")
    assert match.status_code == 200
    assert match.json()["match_id"] == "demo-match"


def test_match_summary_without_azure_config() -> None:
    match = client.get("/match/demo-match/analysis").json()
    response = client.post(
        "/summary/match",
        json={
            "match_id": match["match_id"],
            "team_names": [team["name"] for team in match["teams"]],
            "analysis": match["analysis"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False


def test_demo_player_lookup() -> None:
    response = client.get("/player/mirage_mind")
    assert response.status_code == 200
    body = response.json()
    assert body["nickname"] == "mirage_mind"
    assert body["stats"]["matches_played"] > 0


def test_team_analysis() -> None:
    players = [client.get(f"/player/demo_{index}").json() for index in range(5)]
    response = client.post("/analyze/team", json={"players": players})
    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["score"] <= 10
    assert len(body["roles"]) == 5
    assert "firepower_score" in body
    assert "utility_score" in body


def test_match_analysis_autofills_rosters() -> None:
    response = client.get("/match/demo-match/analysis")
    assert response.status_code == 200
    body = response.json()
    assert body["match_id"] == "demo-match"
    assert len(body["teams"]) == 2
    assert len(body["teams"][0]["players"]) == 5
    assert len(body["teams"][1]["players"]) == 5
    assert body["analysis"]["win_probability"]["friendly_percent"] + body["analysis"]["win_probability"]["enemy_percent"] == 100


def test_sniper_stats_detect_awper() -> None:
    player = Player(
        id="awp",
        nickname="scope",
        stats=PlayerStats(
            kd_ratio=1.22,
            kpr=0.72,
            adr=75,
            headshot_percent=38,
            opening_kill_rate=0.13,
            entry_success_rate=0.48,
            assists_per_round=0.1,
            survival_rate=0.46,
            sniper_kill_rate=0.24,
            sniper_kills_per_round=0.17,
            total_sniper_kills=500,
        ),
    )
    assert detect_role(player).role == "AWPer"


def test_entry_stats_detect_entry() -> None:
    player = Player(
        id="entry",
        nickname="space",
        stats=PlayerStats(
            kd_ratio=1.05,
            kpr=0.76,
            adr=88,
            headshot_percent=49,
            opening_kill_rate=0.23,
            entry_success_rate=0.6,
            total_entry_count=440,
            total_entry_wins=264,
            assists_per_round=0.1,
            survival_rate=0.34,
        ),
    )
    assert detect_role(player).role == "Entry"
