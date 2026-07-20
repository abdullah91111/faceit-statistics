const apiUrl = document.querySelector("#apiUrl");
const matchId = document.querySelector("#matchId");
const friendly = document.querySelector("#friendly");
const analyze = document.querySelector("#analyze");
const result = document.querySelector("#result");

chrome.storage.sync.get(["apiUrl"], (items) => {
  if (items.apiUrl) apiUrl.value = items.apiUrl;
});

apiUrl.addEventListener("change", () => {
  chrome.storage.sync.set({ apiUrl: apiUrl.value });
});

analyze.addEventListener("click", async () => {
  analyze.disabled = true;
  result.textContent = "Analyzing...";
  try {
    if (matchId.value.trim()) {
      const match = await getMatchAnalysis(matchId.value);
      friendly.value = match.teams[0].players.map((player) => player.nickname).join("\n");
      result.innerHTML = renderMatch(match);
      return;
    }
    const names = friendly.value.split(/\n|,/).map((name) => name.trim()).filter(Boolean).slice(0, 5);
    const players = await Promise.all(names.map((name) => getPlayer(name)));
    const analysis = await postJson("/analyze/team", { players });
    result.innerHTML = renderAnalysis(analysis);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Analysis failed";
  } finally {
    analyze.disabled = false;
  }
});

async function getMatchAnalysis(value) {
  const id = value.trim().replace(/\/$/, "").split("/").pop();
  const response = await fetch(`${apiUrl.value}/match/${encodeURIComponent(id)}/analysis`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getPlayer(name) {
  const response = await fetch(`${apiUrl.value}/player/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Could not fetch ${name}`);
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(`${apiUrl.value}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function renderAnalysis(analysis) {
  const roles = analysis.roles
    .map((role) => `<div class="role"><strong>${escapeHtml(role.nickname)}</strong><span>${role.role} ${Math.round(role.confidence * 100)}%</span></div>`)
    .join("");
  const strengths = analysis.strengths.map((strength) => `<li>${escapeHtml(strength)}</li>`).join("");
  const risks = analysis.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
  return `
    <div class="panel">
      <div class="muted">Compatibility</div>
      <h2>${analysis.score}/10 - ${analysis.grade}</h2>
      ${roles}
    </div>
    <div class="panel">
      <strong>Strengths</strong>
      <ul>${strengths}</ul>
    </div>
    <div class="panel">
      <strong>Risks</strong>
      <ul>${risks}</ul>
    </div>
  `;
}

function renderMatch(match) {
  const scout = match.analysis.scouting;
  const strong = scout.strong_players.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  const targets = scout.weak_players.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  return `
    <div class="panel">
      <div class="muted">${escapeHtml(match.status || "match")}</div>
      <h2>${escapeHtml(match.teams[0].name)} vs ${escapeHtml(match.teams[1].name)}</h2>
    </div>
    ${renderAnalysis(match.analysis.friendly)}
    <div class="panel">
      <strong>Enemy Scout</strong>
      <div class="columns">
        <div><span class="muted">Strong</span><ul>${strong}</ul></div>
        <div><span class="muted">Targets</span><ul>${targets}</ul></div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}
