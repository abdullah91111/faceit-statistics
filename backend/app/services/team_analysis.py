import math
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
    WinProbabilityResponse,
)
from app.services.role_detection import detect_roles

CORE_ROLES: tuple[RoleName, ...] = ("Entry", "AWPer", "Support", "Lurker", "Anchor")
ALL_ROLES: tuple[RoleName, ...] = ("Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler")


def analyze_team(players: list[Player]) -> TeamCompatibilityResponse:
    roles = detect_roles(players)
    counts = Counter(role.role for role in roles)
    missing = [role for role in CORE_ROLES if counts[role] == 0]
    duplicates = [role for role, count in counts.items() if count > 1 and role != "Rifler"]

    component_scores = _component_scores(players, counts, missing, duplicates)
    score = round(
        component_scores["role_balance"] * 0.28
        + component_scores["firepower"] * 0.24
        + component_scores["form"] * 0.18
        + component_scores["utility"] * 0.16
        + component_scores["clutch"] * 0.14,
        1,
    )

    avg_form = _avg(players, lambda p: p.stats.recent_win_rate)
    avg_kd = _avg(players, lambda p: p.stats.kd_ratio)
    strengths = _team_strengths(players, counts, avg_form, avg_kd, component_scores)
    risks = _team_risks(missing, duplicates, avg_form, avg_kd, component_scores)
    recommendations = _recommendations(missing, duplicates, avg_form, component_scores)

    return TeamCompatibilityResponse(
        score=score,
        grade=_grade(score),
        roles=roles,
        coverage=[RoleCoverage(role=role, count=counts[role]) for role in ALL_ROLES],
        firepower_score=component_scores["firepower"],
        role_balance_score=component_scores["role_balance"],
        form_score=component_scores["form"],
        utility_score=component_scores["utility"],
        clutch_score=component_scores["clutch"],
        strengths=strengths,
        risks=risks,
        recommendations=recommendations,
    )


def analyze_match(payload: MatchAnalysisRequest) -> MatchAnalysisResponse:
    friendly = analyze_team(payload.friendly_team.players)
    enemy = analyze_team(payload.enemy_team.players)
    scouting = scout_enemy(payload.enemy_team.players)
    win_probability = calculate_win_probability(payload.friendly_team.players, payload.enemy_team.players, friendly, enemy)
    return MatchAnalysisResponse(
        friendly=friendly,
        enemy=enemy,
        scouting=scouting,
        win_probability=win_probability,
    )


def calculate_win_probability(
    friendly_players: list[Player],
    enemy_players: list[Player],
    friendly: TeamCompatibilityResponse,
    enemy: TeamCompatibilityResponse,
) -> WinProbabilityResponse:
    friendly_power = _team_power(friendly_players, friendly)
    enemy_power = _team_power(enemy_players, enemy)
    delta = friendly_power - enemy_power
    friendly_percent = round(100 / (1 + math.exp(-delta / 8)))
    friendly_percent = max(5, min(95, friendly_percent))
    enemy_percent = 100 - friendly_percent

    abs_delta = abs(delta)
    confidence = "high" if abs_delta >= 13 else "medium" if abs_delta >= 6 else "low"
    reasons = _win_probability_reasons(friendly_players, enemy_players, friendly, enemy, delta)

    return WinProbabilityResponse(
        friendly_percent=friendly_percent,
        enemy_percent=enemy_percent,
        confidence=confidence,
        reasons=reasons,
    )


def scout_enemy(players: list[Player]) -> EnemyScoutingResponse:
    all_maps = [map_perf for player in players for map_perf in player.maps if map_perf.matches >= 3]
    best_maps = sorted(all_maps, key=lambda item: (item.win_rate, item.matches), reverse=True)[:5]
    by_power = sorted(players, key=lambda player: (player.stats.kd_ratio, player.stats.adr, player.stats.kpr), reverse=True)
    weak = sorted(players, key=lambda player: (player.stats.kd_ratio, player.stats.recent_win_rate, player.stats.adr))[:2]

    avg_entry = _avg(players, lambda p: p.stats.opening_kill_rate)
    avg_sniper = _avg(players, lambda p: p.stats.sniper_kill_rate)
    avg_utility = _avg(players, lambda p: p.stats.enemies_flashed_per_round + p.stats.utility_usage_per_round)
    avg_hs = _avg(players, lambda p: p.stats.headshot_percent)

    indicators: list[str] = []
    if avg_entry >= 0.16:
        indicators.append("High entry pressure; expect contact-heavy defaults and early duels.")
    if avg_sniper >= 0.12:
        indicators.append("Meaningful sniper profile; deny long sightlines and track AWP economy.")
    if avg_utility >= 0.75:
        indicators.append("Strong utility profile; expect flash-assisted fights and execute pressure.")
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


def _component_scores(players: list[Player], counts: Counter[str], missing: list[RoleName], duplicates: list[RoleName]) -> dict[str, float]:
    avg_kd = _avg(players, lambda p: p.stats.kd_ratio)
    avg_adr = _avg(players, lambda p: p.stats.adr)
    avg_kpr = _avg(players, lambda p: p.stats.kpr)
    avg_form = _avg(players, lambda p: p.stats.recent_win_rate)
    avg_utility = _avg(players, lambda p: p.stats.enemies_flashed_per_round + p.stats.utility_usage_per_round + (p.stats.utility_damage_per_round / 40))
    avg_clutch = _avg(players, lambda p: max(p.stats.clutch_rate, p.stats.clutch_1v1_win_rate * 0.35 + p.stats.clutch_1v2_win_rate * 0.65))

    role_balance = max(0, 10 - len(missing) * 1.25 - len(duplicates) * 0.8)
    if counts["Rifler"] >= 1:
        role_balance = min(10, role_balance + 0.3)

    return {
        "role_balance": round(role_balance, 1),
        "firepower": round(min(((avg_kd / 1.25) * 3.5) + ((avg_adr / 95) * 3.5) + ((avg_kpr / 0.8) * 3), 10), 1),
        "form": round(min(avg_form / 0.7 * 10, 10), 1),
        "utility": round(min(avg_utility / 1.35 * 10, 10), 1),
        "clutch": round(min(avg_clutch / 0.45 * 10, 10), 1),
    }


def _team_power(players: list[Player], analysis: TeamCompatibilityResponse) -> float:
    avg_elo = _avg(players, lambda p: p.elo or 1500)
    avg_level = _avg(players, lambda p: p.skill_level or 5)
    elo_score = min(max((avg_elo - 1000) / 170, 0), 10)
    level_score = min(avg_level, 10)
    return (
        analysis.score * 2.2
        + analysis.firepower_score * 1.5
        + analysis.role_balance_score
        + analysis.form_score * 1.2
        + analysis.utility_score * 0.75
        + analysis.clutch_score * 0.75
        + elo_score
        + level_score * 0.8
    )


def _win_probability_reasons(
    friendly_players: list[Player],
    enemy_players: list[Player],
    friendly: TeamCompatibilityResponse,
    enemy: TeamCompatibilityResponse,
    delta: float,
) -> list[str]:
    reasons: list[str] = []
    if abs(friendly.score - enemy.score) >= 0.8:
        leader = "Friendly" if friendly.score > enemy.score else "Enemy"
        reasons.append(f"{leader} team has the stronger compatibility score.")
    if abs(friendly.firepower_score - enemy.firepower_score) >= 1:
        leader = "Friendly" if friendly.firepower_score > enemy.firepower_score else "Enemy"
        reasons.append(f"{leader} team leads in firepower indicators.")
    if abs(friendly.utility_score - enemy.utility_score) >= 1:
        leader = "Friendly" if friendly.utility_score > enemy.utility_score else "Enemy"
        reasons.append(f"{leader} team has better flash and utility profile.")
    avg_elo_delta = _avg(friendly_players, lambda p: p.elo or 1500) - _avg(enemy_players, lambda p: p.elo or 1500)
    if abs(avg_elo_delta) >= 100:
        leader = "Friendly" if avg_elo_delta > 0 else "Enemy"
        reasons.append(f"{leader} team has the higher average ELO.")
    if not reasons:
        reasons.append("Teams are statistically close; prediction confidence is low.")
    if delta < 0 and len(reasons) < 3:
        reasons.append("Enemy profile has enough edge to offset friendly team strengths.")
    return reasons[:4]


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


def _team_strengths(players: list[Player], counts: Counter[str], avg_form: float, avg_kd: float, scores: dict[str, float]) -> list[str]:
    strengths: list[str] = []
    if all(counts[role] >= 1 for role in CORE_ROLES):
        strengths.append("Complete role coverage across the core CS2 roles.")
    if scores["firepower"] >= 7.2:
        strengths.append("Firepower profile is strong across ADR, K/D, and K/R.")
    if scores["utility"] >= 6.7:
        strengths.append("Utility and flash impact are above average.")
    if avg_form >= 0.58:
        strengths.append("Recent form is positive across the lineup.")
    if avg_kd >= 1.08:
        strengths.append("Team K/D is above average.")
    top_map = _best_team_map(players)
    if top_map:
        strengths.append(f"Shared map comfort trends toward {top_map.map_name}.")
    return strengths or ["No major strengths detected; treat this as a neutral lineup."]


def _team_risks(missing: list[RoleName], duplicates: list[RoleName], avg_form: float, avg_kd: float, scores: dict[str, float]) -> list[str]:
    risks: list[str] = []
    if missing:
        risks.append(f"Missing likely {', '.join(missing)} coverage.")
    if duplicates:
        risks.append(f"Duplicate role pressure around {', '.join(duplicates)}.")
    if scores["utility"] < 4.4:
        risks.append("Low flash and utility profile may make executes easier to read.")
    if avg_form < 0.48:
        risks.append("Recent team form is below neutral.")
    if avg_kd < 0.95:
        risks.append("Low average K/D may make trade conversion difficult.")
    return risks or ["No severe statistical risks detected."]


def _recommendations(missing: list[RoleName], duplicates: list[RoleName], avg_form: float, scores: dict[str, float]) -> list[str]:
    recs: list[str] = []
    if missing:
        recs.append(f"Assign an in-game plan that covers the missing {missing[0]} responsibility.")
    if duplicates:
        recs.append(f"Resolve {duplicates[0]} overlap before queueing so mid-round calls stay clear.")
    if scores["utility"] < 4.4:
        recs.append("Call more flash-assisted fights; raw duels are carrying too much of the plan.")
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


def _avg(players: list[Player], selector) -> float:
    return sum(selector(player) for player in players) / len(players)
