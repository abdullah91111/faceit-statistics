from collections import Counter

from app.models.schemas import (
    EnemyScoutingResponse,
    MapPerformance,
    MatchAnalysisRequest,
    MatchAnalysisResponse,
    Player,
    RoleCoverage,
    RoleName,
    TeamCompatibilityResponse,
)
from app.services.role_detection import detect_roles

CORE_ROLES: tuple[RoleName, ...] = ("Entry", "AWPer", "Support", "Lurker", "Anchor")


def analyze_team(players: list[Player]) -> TeamCompatibilityResponse:
    roles = detect_roles(players)
    counts = Counter(role.role for role in roles)
    missing = [role for role in CORE_ROLES if counts[role] == 0]
    duplicates = [role for role, count in counts.items() if count > 1 and role != "Rifler"]

    avg_form = sum(player.stats.recent_win_rate for player in players) / len(players)
    avg_kd = sum(player.stats.kd_ratio for player in players) / len(players)
    avg_confidence = sum(role.confidence for role in roles) / len(roles)

    role_score = max(0, 4.0 - len(missing) * 0.65 - len(duplicates) * 0.45)
    form_score = avg_form * 2.5
    firepower_score = min(avg_kd / 1.25, 1) * 2.0
    confidence_score = avg_confidence * 1.5
    score = round(min(10, role_score + form_score + firepower_score + confidence_score), 1)

    strengths = _team_strengths(players, counts, avg_form, avg_kd)
    risks = _team_risks(missing, duplicates, avg_form, avg_kd)
    recommendations = _recommendations(missing, duplicates, avg_form)

    return TeamCompatibilityResponse(
        score=score,
        grade=_grade(score),
        roles=roles,
        coverage=[RoleCoverage(role=role, count=counts[role]) for role in ("Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler")],
        strengths=strengths,
        risks=risks,
        recommendations=recommendations,
    )


def analyze_match(payload: MatchAnalysisRequest) -> MatchAnalysisResponse:
    friendly = analyze_team(payload.friendly_team.players)
    enemy = analyze_team(payload.enemy_team.players)
    scouting = scout_enemy(payload.enemy_team.players)
    return MatchAnalysisResponse(friendly=friendly, enemy=enemy, scouting=scouting)


def scout_enemy(players: list[Player]) -> EnemyScoutingResponse:
    all_maps = [map_perf for player in players for map_perf in player.maps if map_perf.matches >= 3]
    best_maps = sorted(all_maps, key=lambda item: (item.win_rate, item.matches), reverse=True)[:5]
    by_power = sorted(players, key=lambda player: (player.stats.kd_ratio, player.stats.adr), reverse=True)
    weak = sorted(players, key=lambda player: (player.stats.kd_ratio, player.stats.recent_win_rate))[:2]

    avg_opening = sum(player.stats.opening_kill_rate for player in players) / len(players)
    avg_survival = sum(player.stats.survival_rate for player in players) / len(players)
    avg_hs = sum(player.stats.headshot_percent for player in players) / len(players)

    indicators: list[str] = []
    if avg_opening >= 0.16:
        indicators.append("High opening-duel pressure; expect fast contact and aggressive peaks.")
    if avg_survival >= 0.42:
        indicators.append("High survival profile; they may prefer late-round resets and trades.")
    if avg_hs >= 48:
        indicators.append("Strong raw rifle aim based on team headshot rate.")
    if not indicators:
        indicators.append("Balanced profile with no single extreme statistical tendency.")

    risks = [
        f"Contain {by_power[0].nickname}; they lead the enemy profile in impact metrics.",
        "Avoid letting their best maps through veto without a clear counter-plan.",
    ]

    return EnemyScoutingResponse(
        best_maps=best_maps,
        strong_players=[player.nickname for player in by_power[:2]],
        weak_players=[player.nickname for player in weak],
        playstyle_indicators=indicators,
        risks=risks,
    )


def _grade(score: float) -> str:
    if score >= 8.7:
        return "S"
    if score >= 7.5:
        return "A"
    if score >= 6.2:
        return "B"
    if score >= 4.8:
        return "C"
    return "D"


def _team_strengths(players: list[Player], counts: Counter[str], avg_form: float, avg_kd: float) -> list[str]:
    strengths: list[str] = []
    if all(counts[role] >= 1 for role in CORE_ROLES):
        strengths.append("Complete role coverage across the core CS2 roles.")
    if avg_form >= 0.58:
        strengths.append("Recent form is positive across the lineup.")
    if avg_kd >= 1.08:
        strengths.append("Team firepower is above average.")
    top_map = _best_team_map(players)
    if top_map:
        strengths.append(f"Shared map comfort trends toward {top_map.map_name}.")
    return strengths or ["No major strengths detected; treat this as a neutral lineup."]


def _team_risks(missing: list[RoleName], duplicates: list[RoleName], avg_form: float, avg_kd: float) -> list[str]:
    risks: list[str] = []
    if missing:
        risks.append(f"Missing likely {', '.join(missing)} coverage.")
    if duplicates:
        risks.append(f"Duplicate role pressure around {', '.join(duplicates)}.")
    if avg_form < 0.48:
        risks.append("Recent team form is below neutral.")
    if avg_kd < 0.95:
        risks.append("Low average K/D may make trade conversion difficult.")
    return risks or ["No severe statistical risks detected."]


def _recommendations(missing: list[RoleName], duplicates: list[RoleName], avg_form: float) -> list[str]:
    recs: list[str] = []
    if missing:
        recs.append(f"Assign an in-game plan that covers the missing {missing[0]} responsibility.")
    if duplicates:
        recs.append(f"Resolve {duplicates[0]} overlap before queueing so mid-round calls stay clear.")
    if avg_form < 0.5:
        recs.append("Start with lower-risk defaults and trade-heavy executes until momentum improves.")
    return recs or ["Keep defaults simple and let the strongest role matchups dictate pace."]


def _best_team_map(players: list[Player]) -> MapPerformance | None:
    maps: dict[str, list[MapPerformance]] = {}
    for player in players:
        for map_perf in player.maps:
            maps.setdefault(map_perf.map_name, []).append(map_perf)
    if not maps:
        return None
    name, values = max(
        maps.items(),
        key=lambda item: sum(map_perf.win_rate * map_perf.matches for map_perf in item[1]) / max(sum(map_perf.matches for map_perf in item[1]), 1),
    )
    matches = sum(map_perf.matches for map_perf in values)
    win_rate = sum(map_perf.win_rate * map_perf.matches for map_perf in values) / max(matches, 1)
    return MapPerformance(map_name=name, win_rate=round(win_rate, 2), matches=matches)
