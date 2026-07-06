import fs from "node:fs";
import {
  configPath,
  dataPath,
  ensureDataDir,
  errorLogPath,
  exampleConfigPath,
  readJson,
  writeJson
} from "./paths.js";
import {
  fetchJson,
  getAppDetails,
  getCurrentPlayers,
  getReviewSummary,
  parseReleaseDate,
  parseSteamSearchRanking,
  sleep
} from "./steam.js";

const config = readJson(configPath, readJson(exampleConfigPath, {}));
if (process.env.TRACK_TOP_N) {
  config.trackTopN = Number(process.env.TRACK_TOP_N);
}
const now = new Date();
const capturedAt = now.toISOString();

ensureDataDir();

const db = readJson(dataPath, {
  meta: {
    schema: 1,
    created_at: capturedAt
  },
  apps: {},
  rank_snapshots: [],
  app_snapshots: []
});

const errors = [];
const currentRankingAppIds = [];
const primaryTrackSourceId =
  config.primaryTrackSourceId || config.rankSources?.[0]?.id || "steam_popular_upcoming";
if (process.env.TRACK_TOP_N) {
  for (const source of config.rankSources || []) {
    if (source.id === primaryTrackSourceId) {
      source.maxRank = config.trackTopN;
    }
  }
}

for (const source of config.rankSources || []) {
  try {
    const rankings = [];
    const maxRank = Number(source.maxRank || config.trackTopN || 50);
    const pageSize = Number(source.pageSize || 100);

    for (let start = 0; start < maxRank; start += pageSize) {
      const payload = await fetchJson(pagedRankUrl(source.url, start, Math.min(pageSize, maxRank - start)));
      const pageRankings = parseSteamSearchRanking(payload, source.id);

      for (const item of pageRankings) {
        rankings.push({
          ...item,
          rank: start + item.rank
        });
      }

      if (pageRankings.length === 0) break;
      await sleep(config.requestDelayMs || 650);
    }

    for (const item of rankings) {
      if (source.id === primaryTrackSourceId) {
        currentRankingAppIds.push(item.appid);
      }
      db.rank_snapshots.push({
        captured_at: capturedAt,
        source: item.source,
        rank: item.rank,
        appid: item.appid,
        name: item.name
      });

      if (source.id === primaryTrackSourceId) {
        db.apps[item.appid] ||= {
          appid: item.appid,
          first_seen_at: capturedAt,
          name: item.name
        };
        db.apps[item.appid].name = item.name || db.apps[item.appid].name;
        db.apps[item.appid].last_seen_rank = item.rank;
        db.apps[item.appid].last_seen_source = item.source;
      }

      if (db.apps[item.appid]) {
        db.apps[item.appid].last_seen_rank_by_source ||= {};
        db.apps[item.appid].last_seen_rank_by_source[item.source] = item.rank;
      }
    }
  } catch (error) {
    errors.push({ at: capturedAt, scope: "rank_source", source: source.id, error: error.message });
  }
}

const candidateAppIds = [...new Set(currentRankingAppIds)].slice(0, config.trackTopN || 50);

for (const appid of candidateAppIds) {
  const snapshot = {
    captured_at: capturedAt,
    appid
  };

  try {
    const details = await getAppDetails(appid, config);
    Object.assign(snapshot, details);

    const app = db.apps[appid] || { appid, first_seen_at: capturedAt };
    app.name = details.name || app.name;
    app.type = details.type || app.type;
    app.developers = details.developers || app.developers || [];
    app.publishers = details.publishers || app.publishers || [];
    app.release_date_text = details.release_date_text || app.release_date_text || "";
    app.planned_release_date =
      parseReleaseDate(details.release_date_text, now) || app.planned_release_date || null;
    app.header_image = details.header_image || app.header_image || "";
    app.store_url = details.store_url || app.store_url || "";

    if (app.was_coming_soon !== false && details.coming_soon === false && !app.detected_release_at) {
      app.detected_release_at = capturedAt;
    }
    app.was_coming_soon = details.coming_soon;
    app.last_snapshot_at = capturedAt;
    db.apps[appid] = app;
  } catch (error) {
    snapshot.appdetails_error = error.message;
    errors.push({ at: capturedAt, scope: "appdetails", appid, error: error.message });
  }

  await sleep(config.requestDelayMs || 650);

  try {
    Object.assign(snapshot, await getReviewSummary(appid));
  } catch (error) {
    snapshot.reviews_error = error.message;
    errors.push({ at: capturedAt, scope: "reviews", appid, error: error.message });
  }

  await sleep(config.requestDelayMs || 650);

  if (snapshot.coming_soon) {
    snapshot.current_players = null;
    snapshot.player_count_status = "skipped_coming_soon";
  } else {
    try {
      Object.assign(snapshot, await getCurrentPlayers(appid));
    } catch (error) {
      snapshot.current_players = null;
      snapshot.players_error = error.message;
      errors.push({ at: capturedAt, scope: "players", appid, error: error.message });
    }
  }

  db.app_snapshots.push(snapshot);
  await sleep(config.requestDelayMs || 650);
}

db.meta.updated_at = capturedAt;
db.meta.track_top_n = config.trackTopN || 50;
db.meta.primary_track_source_id = primaryTrackSourceId;
db.meta.wishlist_rank_source_id = config.wishlistRankSourceId || "steam_top_wishlists";

writeJson(dataPath, db);

if (errors.length) {
  fs.appendFileSync(errorLogPath, errors.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

console.log(
  JSON.stringify(
    {
      captured_at: capturedAt,
      apps_tracked: candidateAppIds.length,
      rank_snapshots: db.rank_snapshots.length,
      app_snapshots: db.app_snapshots.length,
      errors: errors.length
    },
    null,
    2
  )
);

function pagedRankUrl(url, start, count) {
  const parsed = new URL(url);
  parsed.searchParams.set("start", String(start));
  parsed.searchParams.set("count", String(count));
  return parsed.toString();
}
