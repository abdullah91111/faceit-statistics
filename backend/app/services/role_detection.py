from app.models.schemas import Player, RoleDetection, RoleName


ROLE_WEIGHTS: dict[RoleName, dict[str, float]] = {
    "Entry": {
        "opening_kill_rate": 0.34,
        "entry_success_rate": 0.24,
        "adr": 0.2,
        "kpr": 0.12,
        "survival_penalty": 0.1,
    },
    "AWPer": {
        "sniper_kill_rate": 0.38,
        "sniper_kills_per_round": 0.28,
        "kd_ratio": 0.18,
        "survival_rate": 0.1,
        "opening_kill_rate": 0.06,
    },
    "Support": {
        "enemies_flashed_per_round": 0.28,
        "flashes_per_round": 0.22,
        "flash_success_rate": 0.18,
        "utility_usage_per_round": 0.16,
        "utility_damage_per_round": 0.1,
        "assists_per_round": 0.06,
    },
    "Lurker": {
        "clutch_rate": 0.28,
        "clutch_1v1_win_rate": 0.22,
        "survival_rate": 0.2,
        "kd_ratio": 0.16,
        "opening_inverse": 0.14,
    },
    "Anchor": {
        "survival_rate": 0.28,
        "clutch_1v2_win_rate": 0.2,
        "clutch_rate": 0.18,
        "utility_damage_per_round": 0.14,
        "kd_ratio": 0.12,
        "opening_inverse": 0.08,
    },
    "Rifler": {
        "adr": 0.28,
        "kpr": 0.24,
        "headshot_percent": 0.2,
        "kd_ratio": 0.16,
        "sniper_inverse": 0.12,
    },
}


def detect_role(player: Player) -> RoleDetection:
    stats = player.stats.model_dump()
    scores: dict[RoleName, float] = {}

    for role, weights in ROLE_WEIGHTS.items():
        total = 0.0
        for metric, weight in weights.items():
            total += _metric_value(metric, stats) * weight
        scores[role] = round(total * 100, 1)

    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    role, top_score = ordered[0]
    second_score = ordered[1][1] if len(ordered) > 1 else 0
    confidence = max(0.52, min(0.97, 0.55 + ((top_score - second_score) / 100)))

    return RoleDetection(
        player_id=player.id,
        nickname=player.nickname,
        role=role,
        confidence=round(confidence, 2),
        signals=_signals_for_role(player, role),
        score_breakdown=scores,
    )


def detect_roles(players: list[Player]) -> list[RoleDetection]:
    return [detect_role(player) for player in players]


def _metric_value(metric: str, stats: dict[str, float]) -> float:
    if metric == "survival_penalty":
        return 1 - _normalize("survival_rate", stats["survival_rate"])
    if metric == "opening_inverse":
        return 1 - _normalize("opening_kill_rate", stats["opening_kill_rate"])
    if metric == "sniper_inverse":
        return 1 - _normalize("sniper_kill_rate", stats["sniper_kill_rate"])
    return _normalize(metric, stats.get(metric, 0))


def _normalize(metric: str, value: float) -> float:
    caps = {
        "kd_ratio": 1.55,
        "kpr": 0.95,
        "adr": 105,
        "headshot_percent": 65,
        "opening_kill_rate": 0.22,
        "entry_success_rate": 0.62,
        "assists_per_round": 0.28,
        "survival_rate": 0.52,
        "clutch_rate": 0.22,
        "clutch_1v1_win_rate": 0.72,
        "clutch_1v2_win_rate": 0.38,
        "sniper_kill_rate": 0.22,
        "sniper_kills_per_round": 0.16,
        "flashes_per_round": 0.7,
        "enemies_flashed_per_round": 0.55,
        "flash_success_rate": 0.62,
        "utility_damage_per_round": 18,
        "utility_usage_per_round": 0.75,
    }
    return max(0.0, min(float(value) / caps[metric], 1.0))


def _signals_for_role(player: Player, role: RoleName) -> list[str]:
    s = player.stats
    if role == "Entry":
        return [
            f"{s.opening_kill_rate:.0%} entry rate",
            f"{s.entry_success_rate:.0%} entry success",
            f"{s.adr:.0f} ADR",
        ]
    if role == "AWPer":
        return [
            f"{s.sniper_kill_rate:.0%} sniper kill rate",
            f"{s.sniper_kills_per_round:.2f} sniper kills/round",
            f"{s.total_sniper_kills} sniper kills",
        ]
    if role == "Support":
        return [
            f"{s.enemies_flashed_per_round:.2f} enemies flashed/round",
            f"{s.flashes_per_round:.2f} flashes/round",
            f"{s.utility_usage_per_round:.2f} utility uses/round",
        ]
    if role == "Lurker":
        return [
            f"{s.clutch_1v1_win_rate:.0%} 1v1 win rate",
            f"{s.survival_rate:.0%} survival",
            f"{s.opening_kill_rate:.0%} entry rate",
        ]
    if role == "Anchor":
        return [
            f"{s.survival_rate:.0%} survival",
            f"{s.clutch_1v2_win_rate:.0%} 1v2 win rate",
            f"{s.utility_damage_per_round:.1f} utility damage/round",
        ]
    return [
        f"{s.adr:.0f} ADR",
        f"{s.kpr:.2f} K/R",
        f"{s.headshot_percent:.0f}% headshots",
    ]
