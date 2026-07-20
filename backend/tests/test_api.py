from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_config_status() -> None:
    response = client.get("/config/status")
    assert response.status_code == 200
    body = response.json()
    assert body["database_required_for_mvp"] is False
    assert body["llm_enabled"] is False


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


def test_match_analysis_autofills_rosters() -> None:
    response = client.get("/match/demo-match/analysis")
    assert response.status_code == 200
    body = response.json()
    assert body["match_id"] == "demo-match"
    assert len(body["teams"]) == 2
    assert len(body["teams"][0]["players"]) == 5
    assert len(body["teams"][1]["players"]) == 5
