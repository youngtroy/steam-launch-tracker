let db = null;
let selectedAppId = null;

const appSelect = document.querySelector("#appSelect");
const refreshButton = document.querySelector("#refreshButton");

refreshButton.addEventListener("click", load);
appSelect.addEventListener("change", () => {
  selectedAppId = Number(appSelect.value);
  render();
});

load();

async function load() {
  db = await fetchData();
  const apps = sortedApps();

  appSelect.innerHTML = apps
    .map((app) => `<option value="${app.appid}">${escapeHtml(app.name || app.appid)}</option>`)
    .join("");

  if (!selectedAppId && apps.length) selectedAppId = apps[0].appid;
  appSelect.value = String(selectedAppId || "");
  render();
}

async function fetchData() {
  const candidates = ["/api/data", "data/data.json", "./data/data.json"];
  let lastError = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load data");
}

function render() {
  const apps = sortedApps();
  if (!apps.length) {
    document.querySelector(".shell").innerHTML =
      '<div class="empty">还没有数据。先运行 <code>npm run collect</code> 或 <code>npm run sample</code>。</div>';
    return;
  }

  const app = db.apps[selectedAppId] || apps[0];
  selectedAppId = app.appid;
  const timeline = buildTimeline(app.appid);
  renderSummary(app, timeline);
  drawLineChart("rankChart", timeline, "rank", { invert: true, color: "#0e7c86" });
  drawLineChart("playersChart", timeline, "current_players", { color: "#d35c36" });
  drawLineChart("reviewsChart", timeline, "reviews_total", { color: "#7057a8" });
  drawLineChart("rateChart", timeline, "review_positive_rate", {
    color: "#32805c",
    formatY: (v) => `${Math.round(v * 100)}%`,
    maxOverride: 1,
    minOverride: 0
  });
  renderRows(timeline);
}

function sortedApps() {
  const latestRanks = latestRankRows();
  return latestRanks
    .map((row) => db.apps[row.appid] || { appid: row.appid, name: row.name })
    .sort((a, b) => (latestRankFor(a.appid) || 999999) - (latestRankFor(b.appid) || 999999));
}

function buildTimeline(appid) {
  const rankByTime = new Map();
  const sourceId = primarySourceId();
  for (const row of db.rank_snapshots || []) {
    if (row.source === sourceId && Number(row.appid) === Number(appid)) {
      rankByTime.set(row.captured_at, row.rank);
    }
  }

  return (db.app_snapshots || [])
    .filter((row) => Number(row.appid) === Number(appid))
    .map((row) => ({
      ...row,
      rank: rankByTime.get(row.captured_at) ?? null,
      dayOffset: getDayOffset(row)
    }))
    .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
}

function latestRankRows() {
  const rows = db?.rank_snapshots || [];
  if (!rows.length) return [];
  const sourceId = primarySourceId();
  const latestAt = rows.reduce(
    (latest, row) =>
      row.source === sourceId && row.captured_at > latest ? row.captured_at : latest,
    ""
  );
  return rows
    .filter((row) => row.source === sourceId && row.captured_at === latestAt)
    .sort((a, b) => a.rank - b.rank);
}

function primarySourceId() {
  return db?.meta?.primary_track_source_id || "steam_popular_upcoming";
}

function latestRankFor(appid) {
  return latestRankRows().find((row) => Number(row.appid) === Number(appid))?.rank ?? null;
}

function getDayOffset(row) {
  const app = db.apps[row.appid] || {};
  const releaseDate = app.detected_release_at || app.planned_release_date;
  if (!releaseDate) return null;
  const captured = new Date(row.captured_at);
  const release = new Date(releaseDate);
  return Math.round((startOfDay(captured) - startOfDay(release)) / 86400000);
}

function startOfDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function renderSummary(app, timeline) {
  const latest = timeline.at(-1) || {};
  const release = app.detected_release_at || app.planned_release_date || "未知";
  const rank = latest.rank ? `#${latest.rank}` : "无";
  const players = latest.current_players ?? "无";
  const reviews = latest.reviews_total ?? 0;
  const rate =
    latest.review_positive_rate == null
      ? "无"
      : `${Math.round(latest.review_positive_rate * 1000) / 10}%`;

  document.querySelector("#summary").innerHTML = [
    metric("游戏", app.name || app.appid),
    metric("发售点", formatDate(release)),
    metric("热门即将推出排名", rank),
    metric("当前在线", number(players)),
    metric("评测 / 好评率", `${number(reviews)} / ${rate}`)
  ].join("");
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderRows(timeline) {
  document.querySelector("#snapshotRows").innerHTML = timeline
    .slice()
    .reverse()
    .slice(0, 40)
    .map((row) => {
      const rate =
        row.review_positive_rate == null ? "" : `${Math.round(row.review_positive_rate * 1000) / 10}%`;
      return `<tr>
        <td>${formatDateTime(row.captured_at)}</td>
        <td>${row.dayOffset == null ? "" : `D${row.dayOffset >= 0 ? "+" : ""}${row.dayOffset}`}</td>
        <td>${row.rank ? `#${row.rank}` : ""}</td>
        <td>${number(row.current_players)}</td>
        <td>${number(row.reviews_total)}</td>
        <td>${rate}</td>
        <td>${escapeHtml(row.price_text || "")}</td>
      </tr>`;
    })
    .join("");
}

function drawLineChart(canvasId, rows, key, options = {}) {
  const canvas = document.querySelector(`#${canvasId}`);
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(Number(canvas.getAttribute("height")) * dpr);
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const pad = { left: 46, right: 16, top: 14, bottom: 34 };
  ctx.clearRect(0, 0, width, height);

  const values = rows
    .map((row) => ({ x: row.dayOffset, y: row[key] }))
    .filter((point) => point.x != null && point.y != null && Number.isFinite(Number(point.y)));

  drawAxes(ctx, width, height, pad);

  if (!values.length) {
    ctx.fillStyle = "#617078";
    ctx.fillText("暂无数据", pad.left, pad.top + 20);
    return;
  }

  const xs = values.map((point) => point.x);
  const ys = values.map((point) => Number(point.y));
  const minX = Math.min(-7, ...xs);
  const maxX = Math.max(7, ...xs);
  const minY = options.minOverride ?? Math.min(...ys);
  const maxY = options.maxOverride ?? Math.max(...ys);
  const spreadY = maxY - minY || 1;

  const xScale = (x) => pad.left + ((x - minX) / (maxX - minX || 1)) * (width - pad.left - pad.right);
  const yScale = (y) => {
    const ratio = (Number(y) - minY) / spreadY;
    const visual = options.invert ? ratio : 1 - ratio;
    return pad.top + visual * (height - pad.top - pad.bottom);
  };

  ctx.strokeStyle = options.color || "#0e7c86";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((point, index) => {
    const x = xScale(point.x);
    const y = yScale(point.y);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = options.color || "#0e7c86";
  values.forEach((point) => {
    ctx.beginPath();
    ctx.arc(xScale(point.x), yScale(point.y), 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#617078";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(options.formatY ? options.formatY(maxY) : number(maxY), 6, pad.top + 6);
  ctx.fillText(options.formatY ? options.formatY(minY) : number(minY), 6, height - pad.bottom);

  for (const day of [-7, 0, 7]) {
    const x = xScale(day);
    ctx.fillText(`D${day >= 0 ? "+" : ""}${day}`, x - 12, height - 10);
    if (day === 0) {
      ctx.strokeStyle = "#d35c36";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawAxes(ctx, width, height, pad) {
  ctx.strokeStyle = "#d9dfdc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
}

function number(value) {
  if (value == null || value === "") return "";
  if (!Number.isFinite(Number(value))) return String(value);
  return new Intl.NumberFormat().format(Number(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
