from app.models.schemas import Player, RoleDetection, RoleName


ROLE_WEIGHTS: dict[RoleName, dict[str, float]] = {
    "Entry": {"opening_kill_rate": 0.42, "adr": 0.28, "headshot_percent": 0.18, "survival_penalty": 0.12},
    "AWPer": {"kd_ratio": 0.34, "survival_rate": 0.24, "opening_kill_rate": 0.22, "adr": 0.2},
    "Support": {"assists_per_round": 0.44, "survival_rate": 0.22, "recent_win_rate": 0.2, "clutch_rate": 0.14},
    "Lurker": {"survival_rate": 0.34, "clutch_rate": 0.28, "kd_ratio": 0.22, "opening_kill_rate": 0.16},
    "Anchor": {"survival_rate": 0.36, "kd_ratio": 0.24, "clutch_rate": 0.22, "recent_win_rate": 0.18},
    "Rifler": {"adr": 0.34, "headshot_percent": 0.28, "kd_ratio": 0.22, "recent_win_rate": 0.16},
}


def _normalize(metric: str, value: float) -> float:
    caps = {
        "kd_ratio": 1.6,
        "adr": 105,
        "headshot_percent": 65,
        "opening_kill_rate": 0.22,
        "assists_per_round": 0.22,
        "survival_rate": 0.48,
        "clutch_rate": 0.18,
        "recent_win_rate": 0.72,
    }
    return min(value / caps[metric], 1.0)


def detect_role(player: Player) -> RoleDetection:
    stats = player.stats.model_dump()
    scores: dict[RoleName, float] = {}

    for role, weights in ROLE_WEIGHTS.items():
        total = 0.0
        for metric, weight in weights.items():
            if metric == "survival_penalty":
                total += (1 - _normalize("survival_rate", stats["survival_rate"])) * weight
            else:
                total += _normalize(metric, stats[metric]) * weight
        scores[role] = total

    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    role, top_score = ordered[0]
    second_score = ordered[1][1] if len(ordered) > 1 else 0
    confidence = max(0.52, min(0.96, 0.58 + (top_score - second_score)))

    signals = _signals_for_role(player, role)
    return RoleDetection(
        player_id=player.id,
        nickname=player.nickname,
        role=role,
        confidence=round(confidence, 2),
        signals=signals,
    )


def detect_roles(players: list[Player]) -> list[RoleDetection]:
    return [detect_role(player) for player in players]


def _signals_for_role(player: Player, role: RoleName) -> list[str]:
    s = player.stats
    signals: list[str] = []
    if role == "Entry":
        signals.extend([f"{s.opening_kill_rate:.0%} opening-kill rate", f"{s.adr:.0f} ADR pressure"])
    elif role == "AWPer":
        signals.extend([f"{s.kd_ratio:.2f} K/D", f"{s.survival_rate:.0%} survival rate"])
    elif role == "Support":
        signals.extend([f"{s.assists_per_round:.2f} assists per round", f"{s.recent_win_rate:.0%} recent win rate"])
    elif role == "Lurker":
        signals.extend([f"{s.clutch_rate:.0%} clutch rate", f"{s.survival_rate:.0%} survival rate"])
    elif role == "Anchor":
        signals.extend([f"{s.survival_rate:.0%} survival rate", f"{s.clutch_rate:.0%} clutch rate"])
    else:
        signals.extend([f"{s.headshot_percent:.0f}% headshots", f"{s.adr:.0f} ADR"])
    return signals
