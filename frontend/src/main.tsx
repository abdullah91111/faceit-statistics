import React from "react";
import ReactDOM from "react-dom/client";
import { Activity, Crosshair, Link, Search, Shield, Swords } from "lucide-react";

import { analyzeMatch, analyzeMatchId, analyzeTeam, getPlayer } from "./lib/api";
import type { MatchAnalysisResponse, Player, TeamCompatibilityResponse } from "./types/api";
import "./styles.css";

const demoFriendly = ["mirage_mind", "tradecraft", "flashpoint", "late_lurk", "site_lock"];
const demoEnemy = ["sharp_lane", "anchorbyte", "scopefield", "popflash", "underpass"];

function App() {
  const [matchId, setMatchId] = React.useState("");
  const [matchMeta, setMatchMeta] = React.useState<{ id: string; status?: string; url?: string; teamNames: string[] } | null>(null);
  const [friendlyNames, setFriendlyNames] = React.useState(demoFriendly.join("\n"));
  const [enemyNames, setEnemyNames] = React.useState(demoEnemy.join("\n"));
  const [friendly, setFriendly] = React.useState<Player[]>([]);
  const [enemy, setEnemy] = React.useState<Player[]>([]);
  const [team, setTeam] = React.useState<TeamCompatibilityResponse | null>(null);
  const [match, setMatch] = React.useState<MatchAnalysisResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const friendlyPlayers = await Promise.all(namesFromText(friendlyNames).map(getPlayer));
      const enemyPlayers = await Promise.all(namesFromText(enemyNames).map(getPlayer));
      const [teamAnalysis, matchAnalysis] = await Promise.all([
        analyzeTeam(friendlyPlayers),
        analyzeMatch(friendlyPlayers, enemyPlayers),
      ]);
      setFriendly(friendlyPlayers);
      setEnemy(enemyPlayers);
      setTeam(teamAnalysis);
      setMatch(matchAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMatch() {
    if (!matchId.trim()) {
      setError("Paste a FACEIT match ID or match URL first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await analyzeMatchId(matchId);
      const firstTeam = response.teams[0];
      const secondTeam = response.teams[1];
      setFriendly(firstTeam.players);
      setEnemy(secondTeam.players);
      setFriendlyNames(firstTeam.players.map((player) => player.nickname).join("\n"));
      setEnemyNames(secondTeam.players.map((player) => player.nickname).join("\n"));
      setTeam(response.analysis.friendly);
      setMatch(response.analysis);
      setMatchMeta({
        id: response.match_id,
        status: response.status,
        url: response.faceit_url,
        teamNames: [firstTeam.name, secondTeam.name],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match lookup failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void runAnalysis();
  }, []);

  return (
    <main className="min-h-screen bg-ink text-zinc-100">
      <section className="border-b border-line bg-[radial-gradient(circle_at_top_left,#2a3036_0,#101214_42%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-faceit">FACEIT CS2</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">Team Analyzer</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                Paste a FACEIT match ID or URL to auto-fill both teams and analyze their statistics.
              </p>
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100" htmlFor="matchId">
              <Link size={18} />
              Match ID or FACEIT URL
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                id="matchId"
                className="min-h-11 flex-1 rounded border border-line bg-ink px-3 text-sm text-zinc-100 outline-none focus:border-faceit"
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                placeholder="https://www.faceit.com/en/cs2/room/..."
              />
              <button className="primary-button" onClick={loadMatch} disabled={loading}>
                <Search size={18} />
                {loading ? "Loading" : "Load Match"}
              </button>
            </div>
            {matchMeta ? (
              <p className="mt-3 text-sm text-zinc-400">
                {matchMeta.teamNames[0]} vs {matchMeta.teamNames[1]} - {matchMeta.status ?? "unknown"} - {matchMeta.id}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RosterInput title="Friendly Team" value={friendlyNames} onChange={setFriendlyNames} icon={<Shield size={18} />} />
            <RosterInput title="Enemy Team" value={enemyNames} onChange={setEnemyNames} icon={<Swords size={18} />} />
          </div>
          <div className="flex justify-end">
            <button className="secondary-button" onClick={runAnalysis} disabled={loading}>
              Re-analyze Edited Names
            </button>
          </div>
          {error ? <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="space-y-5">
          {team ? <ScorePanel analysis={team} /> : null}
          {match ? <ScoutingPanel analysis={match} /> : null}
        </aside>

        <div className="space-y-5">
          <RosterPanel title="Friendly Roles" players={friendly} analysis={team} />
          {match ? <RosterPanel title="Enemy Roles" players={enemy} analysis={match.enemy} /> : null}
        </div>
      </section>
    </main>
  );
}

function RosterInput(props: { title: string; value: string; onChange: (value: string) => void; icon: React.ReactNode }) {
  return (
    <label className="block rounded border border-line bg-panel p-4">
      <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        {props.icon}
        {props.title}
      </span>
      <textarea
        className="h-32 w-full resize-none rounded border border-line bg-ink p-3 text-sm leading-6 text-zinc-100 outline-none focus:border-faceit"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function ScorePanel({ analysis }: { analysis: TeamCompatibilityResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Compatibility</p>
          <p className="mt-1 text-5xl font-semibold">{analysis.score}</p>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded border border-faceit/60 bg-faceit/10 text-3xl font-bold text-faceit">
          {analysis.grade}
        </div>
      </div>
      <Meter value={analysis.score} max={10} />
      <ListBlock title="Strengths" items={analysis.strengths} />
      <ListBlock title="Risks" items={analysis.risks} />
      <ListBlock title="Recommendations" items={analysis.recommendations} />
    </div>
  );
}

function ScoutingPanel({ analysis }: { analysis: MatchAnalysisResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Crosshair size={18} />
          Enemy Scout
        </h2>
      </div>
      <ListBlock title="Strong Players" items={analysis.scouting.strong_players} />
      <ListBlock title="Targets" items={analysis.scouting.weak_players} />
      <ListBlock title="Indicators" items={analysis.scouting.playstyle_indicators} />
      <div className="mt-4 grid gap-2">
        {analysis.scouting.best_maps.map((map) => (
          <div className="flex items-center justify-between rounded border border-line bg-ink px-3 py-2 text-sm" key={`${map.map_name}-${map.matches}`}>
            <span>{map.map_name}</span>
            <span className="text-aqua">{Math.round(map.win_rate * 100)}% over {map.matches}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterPanel({ title, players, analysis }: { title: string; players: Player[]; analysis: TeamCompatibilityResponse | null }) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Activity size={19} />
        {title}
      </h2>
      <div className="grid gap-3 xl:grid-cols-2">
        {players.map((player) => {
          const role = analysis?.roles.find((item) => item.player_id === player.id);
          return <PlayerCard key={player.id} player={player} role={role} />;
        })}
      </div>
    </div>
  );
}

function PlayerCard({ player, role }: { player: Player; role?: TeamCompatibilityResponse["roles"][number] }) {
  return (
    <article className="rounded border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{player.nickname}</h3>
          <p className="mt-1 text-sm text-zinc-400">Level {player.skill_level ?? "-"} - {player.elo ?? "-"} ELO</p>
        </div>
        {role ? <span className="rounded bg-faceit px-2.5 py-1 text-xs font-semibold text-white">{role.role}</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label="K/D" value={player.stats.kd_ratio.toFixed(2)} />
        <Stat label="ADR" value={player.stats.adr.toFixed(0)} />
        <Stat label="HS" value={`${player.stats.headshot_percent.toFixed(0)}%`} />
        <Stat label="Win" value={`${Math.round(player.stats.recent_win_rate * 100)}%`} />
      </div>
      {role ? <p className="mt-3 text-sm text-zinc-300">{role.signals.join(" - ")} - {Math.round(role.confidence * 100)}% confidence</p> : null}
    </article>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</p>
      <ul className="space-y-2 text-sm text-zinc-300">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-4 h-2 rounded bg-ink">
      <div className="h-full rounded bg-faceit" style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-ink px-2 py-2">
      <p className="font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-zinc-500">{label}</p>
    </div>
  );
}

function namesFromText(value: string): string[] {
  return value.split(/\n|,/).map((name) => name.trim()).filter(Boolean).slice(0, 5);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
