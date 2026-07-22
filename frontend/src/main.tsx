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

import { analyzeMatch, analyzeMatchId, analyzeTeam, getPlayer } from "./lib/api";
import type { MatchAnalysisResponse, Player, RoleName, TeamCompatibilityResponse } from "./types/api";
import "./styles.css";

const roleOrder: RoleName[] = ["Entry", "AWPer", "Support", "Lurker", "Anchor", "Rifler"];

function App() {
  const [matchId, setMatchId] = React.useState("");
  const [matchMeta, setMatchMeta] = React.useState<{ id: string; status?: string; url?: string; teamNames: string[] } | null>(null);
  const [friendlyNames, setFriendlyNames] = React.useState("");
  const [enemyNames, setEnemyNames] = React.useState("");
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

  return (
    <main className="min-h-screen bg-ink text-zinc-100">
      <section className="hero-shell border-b border-line">
        <div className="mx-auto flex min-h-[620px] max-w-7xl flex-col gap-7 px-5 py-8 lg:px-8">
          <header className="flex flex-col gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-faceit">
                <Crosshair size={15} />
                FACEIT CS2 Team Analyzer
              </div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-normal md:text-6xl">Know your match before the first round.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
                Paste a FACEIT CS2 match room link and get both teams auto-filled, role detection, win chance, enemy scouting, and map/player signals calculated from FACEIT stats.
              </p>
            </div>
          </header>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="command-panel">
              <label className="field-label" htmlFor="matchId">
                <Link size={18} />
                Match ID or FACEIT room URL
              </label>
              <div className="flex flex-col gap-3 lg:flex-row">
                <input
                  id="matchId"
                  className="control-input min-h-12 flex-1"
                  value={matchId}
                  onChange={(event) => setMatchId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadMatch();
                  }}
                  placeholder="Paste a FACEIT room URL or match id"
                />
                <button className="primary-button min-w-40" onClick={loadMatch} disabled={loading}>
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                  {loading ? "Analyzing" : "Analyze Match"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Works best with URLs like <span className="font-mono text-zinc-300">faceit.com/en/cs2/room/...</span>. If you paste a scoreboard URL, use the room id part.
              </p>
              {matchMeta ? <MatchMeta meta={matchMeta} /> : null}
              {error ? <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
            </div>

            <HowItWorks />
          </section>

          {match && team ? <OverviewGrid match={match} /> : null}
        </div>
      </section>

      {!match ? <EmptyState /> : null}

      {match ? <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[390px_1fr] lg:px-8">
        <aside className="space-y-5">
          {match ? <WinProbabilityPanel match={match} /> : null}
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
      </section> : null}
    </main>
  );
}

function HowItWorks() {
  return (
    <div className="rounded border border-line bg-panel/90 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Activity size={18} /> What you get</h2>
      <div className="mt-4 grid gap-3">
        <FeatureLine title="Auto rosters" text="Reads both teams from the FACEIT match." />
        <FeatureLine title="Role detection" text="Entry, AWPer, Support, Lurker, Anchor, Rifler." />
        <FeatureLine title="Win chance" text="Calculated from role balance, form, ELO, utility, and firepower." />
        <FeatureLine title="Enemy scout" text="Strong players, targets, map comfort, and playstyle signals." />
      </div>
    </div>
  );
}

function FeatureLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-line bg-ink/70 p-3">
      <p className="text-sm font-semibold text-zinc-100">{title}</p>
      <p className="mt-1 text-sm leading-5 text-zinc-500">{text}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-7 lg:px-8">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Target size={19} />} label="Prediction" value="Win %" sub="team chance from stats" />
        <MetricCard icon={<Users size={19} />} label="Roles" value="6" sub="detected player profiles" />
        <MetricCard icon={<BarChart3 size={19} />} label="Signals" value="20+" sub="entry, sniper, utility, clutch" />
      </div>
    </section>
  );
}

function WinProbabilityPanel({ match }: { match: MatchAnalysisResponse }) {
  return (
    <div className="rounded border border-line bg-panel p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Target size={18} /> Win Probability</h2>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-4xl font-semibold text-aqua">{match.win_probability.friendly_percent}%</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Friendly</p>
        </div>
        <div className="text-zinc-600">vs</div>
        <div className="text-right">
          <p className="text-4xl font-semibold text-faceit">{match.win_probability.enemy_percent}%</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Enemy</p>
        </div>
      </div>
      <Meter value={match.win_probability.friendly_percent} max={100} />
      <p className="mt-3 text-sm text-zinc-400">Confidence: {match.win_probability.confidence}</p>
      <ListBlock title="Reasons" items={match.win_probability.reasons} />
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

function OverviewGrid({ match }: { match: MatchAnalysisResponse }) {
  const friendly = match.friendly;
  const enemy = match.enemy;
  const edge = Number((friendly.score - enemy.score).toFixed(1));
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <MetricCard
        icon={<Target size={19} />}
        label="Win Chance"
        value={`${match.win_probability.friendly_percent}%`}
        sub={`${match.win_probability.confidence} confidence`}
      />
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
      <ComponentScores analysis={analysis} />
      <ListBlock title="Strengths" items={analysis.strengths} icon={<CheckCircle2 size={15} />} />
      <ListBlock title="Risks" items={analysis.risks} icon={<AlertTriangle size={15} />} />
      <ListBlock title="Recommendations" items={analysis.recommendations} icon={<Target size={15} />} />
    </div>
  );
}

function ComponentScores({ analysis }: { analysis: TeamCompatibilityResponse }) {
  const rows = [
    ["Roles", analysis.role_balance_score],
    ["Firepower", analysis.firepower_score],
    ["Form", analysis.form_score],
    ["Utility", analysis.utility_score],
    ["Clutch", analysis.clutch_score],
  ] as const;
  return (
    <div className="mt-4 grid gap-2">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[78px_1fr_34px] items-center gap-2 text-xs" key={label}>
          <span className="text-zinc-500">{label}</span>
          <div className="h-2 rounded bg-ink">
            <div className="h-full rounded bg-aqua" style={{ width: `${value * 10}%` }} />
          </div>
          <span className="text-right text-zinc-400">{value.toFixed(1)}</span>
        </div>
      ))}
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
        <Stat label="K/R" value={player.stats.kpr.toFixed(2)} />
        <Stat label="Win" value={`${Math.round(player.stats.recent_win_rate * 100)}%`} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label="Entry" value={`${Math.round(player.stats.opening_kill_rate * 100)}%`} />
        <Stat label="Sniper" value={`${Math.round(player.stats.sniper_kill_rate * 100)}%`} />
        <Stat label="Flash" value={player.stats.enemies_flashed_per_round.toFixed(2)} />
        <Stat label="Clutch" value={`${Math.round(player.stats.clutch_1v1_win_rate * 100)}%`} />
      </div>
      {role ? <p className="mt-3 text-sm leading-6 text-zinc-300">{role.signals.join(" - ")} - {Math.round(role.confidence * 100)}% confidence</p> : null}
      {role ? <RoleBreakdown role={role} /> : null}
    </article>
  );
}

function RoleBreakdown({ role }: { role: TeamCompatibilityResponse["roles"][number] }) {
  const entries = Object.entries(role.score_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="mt-3 grid gap-1.5">
      {entries.map(([name, value]) => (
        <div className="grid grid-cols-[64px_1fr_34px] items-center gap-2 text-xs" key={name}>
          <span className="text-zinc-500">{name}</span>
          <div className="h-1.5 rounded bg-ink">
            <div className="h-full rounded bg-faceit" style={{ width: `${Math.min(value, 100)}%` }} />
          </div>
          <span className="text-right text-zinc-400">{value.toFixed(0)}</span>
        </div>
      ))}
    </div>
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
