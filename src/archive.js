import fs from "node:fs";
import path from "node:path";
import {
  configPath,
  dataDir,
  dataPath,
  ensureDataDir,
  exampleConfigPath,
  readJson,
  writeJson
} from "./paths.js";

const config = readJson(configPath, readJson(exampleConfigPath, {}));
const db = readJson(dataPath, {
  meta: {},
  apps: {},
  rank_snapshots: [],
  app_snapshots: []
});

const wishlistSourceId = config.wishlistRankSourceId || "steam_top_wishlists";
const primarySourceId = config.primaryTrackSourceId || "steam_popular_upcoming";
const beforeDays = Number(config.windowDaysBefore || 7);
const afterDays = Number(config.windowDaysAfter || 7);
const archivedAt = new Date().toISOString();

ensureDataDir();

const rankByAppDay = new Map();
const rankSourceDays = new Set();
const primaryAppRanks = new Map();
for (const snapshot of db.rank_snapshots || []) {
  const day = dayKey(snapshot.captured_at);

  if (snapshot.source === primarySourceId) {
    const existing = primaryAppRanks.get(snapshot.appid);
    if (!existing || snapshot.captured_at > existing.captured_at) {
      primaryAppRanks.set(snapshot.appid, snapshot);
    }
  }

  if (snapshot.source === wishlistSourceId) {
    rankSourceDays.add(day);
    const key = `${snapshot.appid}|${day}`;
    const existing = rankByAppDay.get(key);
    if (!existing || snapshot.captured_at > existing.captured_at) {
      rankByAppDay.set(key, snapshot);
    }
  }
}

const appSnapshotByAppDay = new Map();
for (const snapshot of db.app_snapshots || []) {
  const day = dayKey(snapshot.captured_at);
  const key = `${snapshot.appid}|${day}`;
  const existing = appSnapshotByAppDay.get(key);
  if (!existing || snapshot.captured_at > existing.captured_at) {
    appSnapshotByAppDay.set(key, snapshot);
  }
}

const apps = [...primaryAppRanks.values()].map((rankSnapshot) => {
  return db.apps[rankSnapshot.appid] || {
    appid: rankSnapshot.appid,
    name: rankSnapshot.name || ""
  };
}).sort((a, b) => {
  return String(a.name || a.appid).localeCompare(String(b.name || b.appid));
});

const archive = {
  meta: {
    schema: 1,
    archived_at: archivedAt,
    tracking_pool_source: primarySourceId,
    wishlist_rank_source: wishlistSourceId,
    window_days_before: beforeDays,
    window_days_after: afterDays
  },
  apps: []
};

for (const app of apps) {
  const releaseDate = releaseDay(app);
  if (!releaseDate) continue;

  const pre_launch_wishlist_ranks = [];
  for (let offset = -beforeDays; offset <= -1; offset += 1) {
    const date = addDays(releaseDate, offset);
    const rank = rankByAppDay.get(`${app.appid}|${date}`);
    pre_launch_wishlist_ranks.push({
      date,
      day_offset: offset,
      wishlist_rank: rank?.rank ?? null,
      status: wishlistRankStatus(date, rank),
      captured_at: rank?.captured_at ?? null
    });
  }

  const post_launch_review_counts = [];
  for (let offset = 0; offset <= afterDays; offset += 1) {
    const date = addDays(releaseDate, offset);
    const snapshot = appSnapshotByAppDay.get(`${app.appid}|${date}`);
    post_launch_review_counts.push({
      date,
      day_offset: offset,
      reviews_total: snapshot?.reviews_total ?? null,
      reviews_positive: snapshot?.reviews_positive ?? null,
      reviews_negative: snapshot?.reviews_negative ?? null,
      captured_at: snapshot?.captured_at ?? null
    });
  }

  archive.apps.push({
    appid: app.appid,
    name: app.name || "",
    release_date: releaseDate,
    release_date_text: app.release_date_text || "",
    detected_release_at: app.detected_release_at || null,
    store_url: app.store_url || `https://store.steampowered.com/app/${app.appid}/`,
    pre_launch_wishlist_ranks,
    post_launch_review_counts
  });
}

writeJson(path.join(dataDir, "archive.json"), archive);
writeCsv(path.join(dataDir, "archive.csv"), archive);

console.log(
  JSON.stringify(
    {
      archived_at: archivedAt,
      apps_archived: archive.apps.length,
      json: path.join(dataDir, "archive.json"),
      csv: path.join(dataDir, "archive.csv")
    },
    null,
    2
  )
);

function releaseDay(app) {
  if (app.detected_release_at) return dayKey(app.detected_release_at);
  if (app.planned_release_date && /^\d{4}-\d{2}-\d{2}$/.test(app.planned_release_date)) {
    return app.planned_release_date;
  }
  return null;
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function wishlistRankStatus(date, rank) {
  if (rank) return "ok";
  if (!rankSourceDays.has(date)) return "not_collected";
  return "not_in_captured_wishlist_ranking";
}

function writeCsv(filePath, archiveData) {
  const rows = [
    [
      "appid",
      "name",
      "release_date",
      "metric",
      "date",
      "day_offset",
      "value",
      "status",
      "captured_at"
    ]
  ];

  for (const app of archiveData.apps) {
    for (const item of app.pre_launch_wishlist_ranks) {
      rows.push([
        app.appid,
        app.name,
        app.release_date,
        "pre_launch_wishlist_rank",
        item.date,
        item.day_offset,
        item.wishlist_rank ?? "",
        item.status,
        item.captured_at ?? ""
      ]);
    }

    for (const item of app.post_launch_review_counts) {
      rows.push([
        app.appid,
        app.name,
        app.release_date,
        "post_launch_reviews_total",
        item.date,
        item.day_offset,
        item.reviews_total ?? "",
        item.reviews_total == null ? "not_collected" : "ok",
        item.captured_at ?? ""
      ]);
    }
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  writeRaw(filePath, csv);
}

function csvCell(value) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function writeRaw(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}
