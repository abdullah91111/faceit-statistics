export type RoleName = "Entry" | "AWPer" | "Support" | "Lurker" | "Anchor" | "Rifler";

export interface PlayerStats {
  kd_ratio: number;
  adr: number;
  headshot_percent: number;
  opening_kill_rate: number;
  assists_per_round: number;
  survival_rate: number;
  clutch_rate: number;
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
}

export interface TeamCompatibilityResponse {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  roles: RoleDetection[];
  coverage: { role: RoleName; count: number }[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface MatchAnalysisResponse {
  friendly: TeamCompatibilityResponse;
  enemy: TeamCompatibilityResponse;
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
