export type RoleName = "Entry" | "AWPer" | "Support" | "Lurker" | "Anchor" | "Rifler";

export interface PlayerStats {
  kd_ratio: number;
  kpr: number;
  adr: number;
  headshot_percent: number;
  opening_kill_rate: number;
  entry_success_rate: number;
  total_entry_count: number;
  total_entry_wins: number;
  assists_per_round: number;
  survival_rate: number;
  clutch_rate: number;
  clutch_1v1_win_rate: number;
  clutch_1v2_win_rate: number;
  sniper_kill_rate: number;
  sniper_kills_per_round: number;
  total_sniper_kills: number;
  flashes_per_round: number;
  enemies_flashed_per_round: number;
  flash_success_rate: number;
  utility_damage_per_round: number;
  utility_usage_per_round: number;
  recent_win_rate: number;
  matches_played: number;
}

export interface MapPerformance {
  map_name: string;
  win_rate: number;
  matches: number;
}

export interface Player {
  id: string;
  nickname: string;
  country?: string;
  skill_level?: number;
  elo?: number;
  stats: PlayerStats;
  maps: MapPerformance[];
}

export interface RoleDetection {
  player_id: string;
  nickname: string;
  role: RoleName;
  confidence: number;
  signals: string[];
  score_breakdown: Record<RoleName, number>;
}

export interface TeamCompatibilityResponse {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  roles: RoleDetection[];
  coverage: { role: RoleName; count: number }[];
  firepower_score: number;
  role_balance_score: number;
  form_score: number;
  utility_score: number;
  clutch_score: number;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface MatchAnalysisResponse {
  friendly: TeamCompatibilityResponse;
  enemy: TeamCompatibilityResponse;
  win_probability: {
    friendly_percent: number;
    enemy_percent: number;
    confidence: "low" | "medium" | "high";
    reasons: string[];
  };
  scouting: {
    best_maps: MapPerformance[];
    strong_players: string[];
    weak_players: string[];
    playstyle_indicators: string[];
    risks: string[];
  };
}

export interface MatchRosterTeam {
  faction_id: string;
  name: string;
  players: Player[];
}

export interface MatchRosterAnalysisResponse {
  match_id: string;
  status?: string;
  faceit_url?: string;
  teams: MatchRosterTeam[];
  analysis: MatchAnalysisResponse;
}

export interface ConfigStatus {
  faceit_api_key: boolean;
  database_url: boolean;
  database_required_for_mvp: boolean;
  llm_enabled: boolean;
}
