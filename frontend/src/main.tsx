import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Gauge,
  Link,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Target,
  Users,
} from "lucide-react";

import { analyzeMatch, analyzeMatchId, analyzeTeam, getConfigStatus, getPlayer } from "./lib/api";
import type { ConfigStatus, MatchAnalysisResponse, Player, RoleName, TeamCompatibilityResponse } from "./types/api";
import "./styles.css";

const demoFriendly = ["mirage_mind", "tradecraft", "flashpoint", "late_lurk", "site_lock"];
const demoEnemy = ["sharp_lane", "anchorbyte", "scopefield", "popflash", "underpass"];
const roleOrder: RoleName[] = ["Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler"];

function App() {
  const [matchId, setMatchId] = React.useState("demo-match");
  const [matchMeta, setMatchMeta] = React.useState<{ id: string; status?: string; url?: string; teamNames: string[] } | null>(null);
  const [friendlyNames, setFriendlyNames] = React.useState(demoFriendly.join("\n"));
  const [enemyNames, setEnemyNames] = React.useState(demoEnemy.join("\n"));
  const [friendly, setFriendly] = React.useState<Player[]>([]);
  const [enemy, setEnemy] = React.useState<Player[]>([]);
  const [team, setTeam] = React.useState<TeamCompatibilityResponse | null>(null);
  const [match, setMatch] = React.useState<MatchAnalysisResponse | null>(null);
  const [config, setConfig] = React.useState<ConfigStatus | null>(null);
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
      setMatchMeta(null);
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
    getConfigStatus().then(setConfig).catch(() => setConfig(null));
    void loadMatch();
  }, []);

  return (
    <main className="min-h-screen bg-ink text-zinc-100">
      <section className="border-b border-line bg-[linear-gradient(135deg,#111418_0%,#171b20_52%,#101214_100%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-7 lg:px-8">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-faceit">
                <Crosshair size={15} />
                FACEIT CS2 Match Intel
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-5xl">Pre-Queue Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                Load a FACEIT match, auto-fill both rosters, and get role balance, form, map comfort, and enemy scouting from code-calculated stats.
              </p>
            </div>
            <StatusStrip config={config} />
          </header>

          <section className="command-panel">
            <label className="field-label" htmlFor="matchId">
              <Link size={18} />
              Match ID or FACEIT URL
            </label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                id="matchId"
                className="control-input min-h-12 flex-1"
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                placeholder="https://www.faceit.com/en/cs2/room/..."
              />
              <button className="primary-button min-w-40" onClick={loadMatch} disabled={loading}>
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                {loading ? "Loading" : "Load Match"}
              </button>
            </div>
            {matchMeta ? <MatchMeta meta={matchMeta} /> : null}
            {error ? <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
          </section>

          {match && team ? <OverviewGrid friendly={team} enemy={match.enemy} /> : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[390px_1fr] lg:px-8">
        <aside className="space-y-5">
          {team ? <ScorePanel title="Friendly Readiness" icon={<Shield size={18} />} analysis={team} /> : null}
          {match ? <ScoutingPanel analysis={match} /> : null}
          {match ? <RoleCoveragePanel friendly={match.friendly} enemy={match.enemy} /> : null}
        </aside>

        <div className="space-y-5">
          <RosterEditors
            friendlyNames={friendlyNames}
            enemyNames={enemyNames}
            setFriendlyNames={setFriendlyNames}
            setEnemyNames={setEnemyNames}
            runAnalysis={runAnalysis}
            loading={loading}
          />
          <RosterPanel title={matchMeta?.teamNames[0] ?? "Friendly Roles"} players={friendly} analysis={team} accent="friendly" />
          {match ? <RosterPanel title={matchMeta?.teamNames[1] ?? "Enemy Roles"} players={enemy} analysis={match.enemy} accent="enemy" /> : null}
        </div>
      </section>
    </main>
  );
}

function StatusStrip({ config }: { config: ConfigStatus | null }) {
  return (
    <div className="grid min-w-72 gap-2 sm:grid-cols-2">
      <StatusPill label="FACEIT API" enabled={config?.faceit_api_key ?? false} />
      <StatusPill label="Database" enabled={config?.database_url ?? false} muted="optional" />
      <StatusPill label="LLM" enabled={false} muted="off" />
      <StatusPill label="MVP Mode" enabled />
    </div>
  );
}

function StatusPill({ label, enabled, muted }: { label: string; enabled: boolean; muted?: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-line bg-panel/90 px-3 py-2 text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className={enabled ? "text-aqua" : "text-zinc-500"}>{enabled ? "ready" : muted ?? "missing"}</span>
    </div>
  );
}

function MatchMeta({ meta }: { meta: { id: string; status?: string; url?: string; teamNames: string[] } }) {
  return (
    <div className="mt-4 grid gap-3 rounded border border-line bg-ink/70 p-3 text-sm md:grid-cols-3">
      <MetaItem label="Match" value={meta.id} />
      <MetaItem label="Status" value={meta.status ?? "unknown"} />
      <MetaItem label="Teams" value={`${meta.teamNames[0]} vs ${meta.teamNames[1]}`} />
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function OverviewGrid({ friendly, enemy }: { friendly: TeamCompatibilityResponse; enemy: TeamCompatibilityResponse }) {
  const edge = Number((friendly.score - enemy.score).toFixed(1));
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MetricCard icon={<Gauge size={19} />} label="Friendly Score" value={`${friendly.score}/10`} sub={`Grade ${friendly.grade}`} />
      <MetricCard icon={<Swords size={19} />} label="Enemy Score" value={`${enemy.score}/10`} sub={`Grade ${enemy.grade}`} />
      <MetricCard icon={<BarChart3 size={19} />} label="Score Edge" value={edge > 0 ? `+${edge}` : `${edge}`} sub={edge >= 0 ? "favorable" : "enemy favored"} />
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">{icon}{label}</div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function RosterEditors(props: {
  friendlyNames: string;
  enemyNames: string;
  setFriendlyNames: (value: string) => void;
  setEnemyNames: (value: string) => void;
  runAnalysis: () => void;
  loading: boolean;
}) {
  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users size={19} /> Rosters</h2>
          <p className="mt-1 text-sm text-zinc-500">Auto-filled from match lookup, still editable for quick what-if checks.</p>
        </div>
        <button className="secondary-button" onClick={props.runAnalysis} disabled={props.loading}>
          <RefreshCw size={16} />
          Re-analyze
        </button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <RosterInput title="Friendly Team" value={props.friendlyNames} onChange={props.setFriendlyNames} icon={<Shield size={18} />} />
        <RosterInput title="Enemy Team" value={props.enemyNames} onChange={props.setEnemyNames} icon={<Swords size={18} />} />
      </div>
    </section>
  );
}

function RosterInput(props: { title: string; value: string; onChange: (value: string) => void; icon: React.ReactNode }) {
  return (
    <label className="block rounded border border-line bg-ink/70 p-4">
      <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        {props.icon}
        {props.title}
      </span>
      <textarea
        className="control-input h-32 w-full resize-none p-3 leading-6"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function ScorePanel({ title, icon, analysis }: { title: string; icon: React.ReactNode; analysis: TeamCompatibilityResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2>
          <p className="mt-3 text-5xl font-semibold">{analysis.score}</p>
          <p className="mt-1 text-sm text-zinc-500">Compatibility score out of 10</p>
        </div>
        <div className="grade-badge">{analysis.grade}</div>
      </div>
      <Meter value={analysis.score} max={10} />
      <ListBlock title="Strengths" items={analysis.strengths} icon={<CheckCircle2 size={15} />} />
      <ListBlock title="Risks" items={analysis.risks} icon={<AlertTriangle size={15} />} />
      <ListBlock title="Recommendations" items={analysis.recommendations} icon={<Target size={15} />} />
    </div>
  );
}

function ScoutingPanel({ analysis }: { analysis: MatchAnalysisResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Crosshair size={18} />
        Enemy Scout
      </h2>
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

function RoleCoveragePanel({ friendly, enemy }: { friendly: TeamCompatibilityResponse; enemy: TeamCompatibilityResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Activity size={18} /> Role Coverage</h2>
      <div className="mt-4 grid gap-3">
        {roleOrder.map((role) => (
          <div className="grid grid-cols-[72px_1fr_1fr] items-center gap-3 text-sm" key={role}>
            <span className="text-zinc-400">{role}</span>
            <CoverageBar value={coverageCount(friendly, role)} tone="friendly" />
            <CoverageBar value={coverageCount(enemy, role)} tone="enemy" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageBar({ value, tone }: { value: number; tone: "friendly" | "enemy" }) {
  return (
    <div className="flex h-8 items-center rounded border border-line bg-ink px-2">
      <div className={tone === "friendly" ? "h-2 rounded bg-aqua" : "h-2 rounded bg-faceit"} style={{ width: `${Math.min(value * 45, 100)}%` }} />
      <span className="ml-auto text-xs text-zinc-500">{value}</span>
    </div>
  );
}

function RosterPanel({ title, players, analysis, accent }: { title: string; players: Player[]; analysis: TeamCompatibilityResponse | null; accent: "friendly" | "enemy" }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {accent === "friendly" ? <Shield size={19} /> : <Swords size={19} />}
        {title}
      </h2>
      <div className="grid gap-3 xl:grid-cols-2">
        {players.map((player) => {
          const role = analysis?.roles.find((item) => item.player_id === player.id);
          return <PlayerCard key={player.id} player={player} role={role} accent={accent} />;
        })}
      </div>
    </section>
  );
}

function PlayerCard({ player, role, accent }: { player: Player; role?: TeamCompatibilityResponse["roles"][number]; accent: "friendly" | "enemy" }) {
  return (
    <article className={`player-card ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{player.nickname}</h3>
          <p className="mt-1 text-sm text-zinc-400">Level {player.skill_level ?? "-"} - {player.elo ?? "-"} ELO</p>
        </div>
        {role ? <span className="role-chip">{role.role}</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label="K/D" value={player.stats.kd_ratio.toFixed(2)} />
        <Stat label="ADR" value={player.stats.adr.toFixed(0)} />
        <Stat label="HS" value={`${player.stats.headshot_percent.toFixed(0)}%`} />
        <Stat label="Win" value={`${Math.round(player.stats.recent_win_rate * 100)}%`} />
      </div>
      {role ? <p className="mt-3 text-sm leading-6 text-zinc-300">{role.signals.join(" - ")} - {Math.round(role.confidence * 100)}% confidence</p> : null}
    </article>
  );
}

function ListBlock({ title, items, icon }: { title: string; items: string[]; icon?: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{icon}{title}</p>
      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
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

function coverageCount(analysis: TeamCompatibilityResponse, role: RoleName): number {
  return analysis.coverage.find((item) => item.role === role)?.count ?? 0;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
