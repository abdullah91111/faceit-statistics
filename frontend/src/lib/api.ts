import type { ConfigStatus, MatchAnalysisResponse, MatchRosterAnalysisResponse, Player, TeamCompatibilityResponse } from "../types/api";

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:8001");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getPlayer(id: string): Promise<Player> {
  return request<Player>(`/player/${encodeURIComponent(id)}`);
}

export function getConfigStatus(): Promise<ConfigStatus> {
  return request<ConfigStatus>("/config/status");
}

export function analyzeTeam(players: Player[]): Promise<TeamCompatibilityResponse> {
  return request<TeamCompatibilityResponse>("/analyze/team", {
    method: "POST",
    body: JSON.stringify({ players }),
  });
}

export function analyzeMatch(friendly: Player[], enemy: Player[]): Promise<MatchAnalysisResponse> {
  return request<MatchAnalysisResponse>("/analyze/match", {
    method: "POST",
    body: JSON.stringify({
      friendly_team: { name: "Friendly", players: friendly },
      enemy_team: { name: "Enemy", players: enemy },
    }),
  });
}

export function analyzeMatchId(matchIdOrUrl: string): Promise<MatchRosterAnalysisResponse> {
  const matchId = matchIdOrUrl.trim().replace(/\/$/, "").split("/").pop() ?? matchIdOrUrl;
  return request<MatchRosterAnalysisResponse>(`/match/${encodeURIComponent(matchId)}/analysis`);
}
