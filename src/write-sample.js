import { dataPath, writeJson } from "./paths.js";

const now = new Date("2026-07-03T08:00:00.000Z");
const appid = 999001;

const rank_snapshots = [];
const app_snapshots = [];

for (let day = -7; day <= 7; day++) {
  const captured = new Date(now);
  captured.setUTCDate(now.getUTCDate() + day);
  const captured_at = captured.toISOString();
  const rank = Math.max(1, 35 - (day + 7) * 2 + (day > 1 ? day * 3 : 0));
  const reviews_total = day < 0 ? 0 : Math.round(day * day * 45 + day * 120);

  rank_snapshots.push({
    captured_at,
    source: "steam_top_wishlists",
    rank,
    appid,
    name: "Example Launch Game"
  });

  app_snapshots.push({
    captured_at,
    appid,
    ok: true,
    name: "Example Launch Game",
    coming_soon: day < 0,
    release_date_text: "3 Jul, 2026",
    price_text: "$19.99",
    discount_percent: day >= 0 && day <= 7 ? 10 : 0,
    recommendations_total: reviews_total,
    reviews_total,
    reviews_positive: Math.round(reviews_total * 0.84),
    reviews_negative: Math.round(reviews_total * 0.16),
    review_positive_rate: reviews_total ? 0.84 : null,
    current_players: day < 0 ? null : Math.round(1800 * Math.exp(-Math.abs(day - 1) / 2.4) + 120)
  });
}

writeJson(dataPath, {
  meta: {
    schema: 1,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    sample: true
  },
  apps: {
    [appid]: {
      appid,
      first_seen_at: "2026-06-26T08:00:00.000Z",
      detected_release_at: "2026-07-03T08:00:00.000Z",
      name: "Example Launch Game",
      type: "game",
      developers: ["Example Studio"],
      publishers: ["Example Publisher"],
      release_date_text: "3 Jul, 2026",
      planned_release_date: "2026-07-03",
      store_url: "https://store.steampowered.com/",
      last_seen_rank: 24,
      last_seen_source: "steam_top_wishlists"
    }
  },
  rank_snapshots,
  app_snapshots
});

console.log(`Wrote sample data to ${dataPath}`);
