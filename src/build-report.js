import fs from "node:fs";
import path from "node:path";
import { dataDir, readJson } from "./paths.js";

const archivePath = path.join(dataDir, "archive.json");
const archive = readJson(archivePath, { meta: {}, apps: [] });
const generatedAt = archive.meta?.archived_at || new Date().toISOString();

const report = [
  "# Steam Launch Tracker Report",
  "",
  `Generated at: ${generatedAt}`,
  "",
  "This report tracks games from Steam Popular Upcoming. Wishlist rank values are matched from Steam Top Wishlists by appid; Steam does not expose public wishlist counts.",
  "",
  "## Files",
  "",
  "- Raw snapshot database: [`data/data.json`](data/data.json)",
  "- T-7 to T+7 archive: [`data/archive.json`](data/archive.json)",
  "- Spreadsheet-friendly export: [`data/archive.csv`](data/archive.csv)",
  "",
  "## Summary",
  "",
  `- Tracking pool: \`${archive.meta?.tracking_pool_source || "unknown"}\``,
  `- Wishlist rank source: \`${archive.meta?.wishlist_rank_source || "unknown"}\``,
  `- Apps archived: ${archive.apps?.length || 0}`,
  `- Window: T-${archive.meta?.window_days_before ?? 7} to T+${archive.meta?.window_days_after ?? 7}`,
  "",
  "## Compact Table",
  "",
  makeCompactTable(archive.apps || []),
  "",
  "## Details",
  "",
  ...makeDetails(archive.apps || [])
].join("\n");

fs.writeFileSync(path.join(process.cwd(), "REPORT.md"), report, "utf8");

console.log(
  JSON.stringify(
    {
      report: path.join(process.cwd(), "REPORT.md"),
      apps: archive.apps?.length || 0
    },
    null,
    2
  )
);

function makeCompactTable(apps) {
  const headers = [
    "App",
    "Release",
    "T-7",
    "T-6",
    "T-5",
    "T-4",
    "T-3",
    "T-2",
    "T-1",
    "D0",
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
    "D7"
  ];
  const rows = [headers, headers.map(() => "---")];

  for (const app of apps) {
    rows.push([
      `[${escapeMd(app.name || app.appid)}](${app.store_url})`,
      app.release_date || "",
      ...offsetValues(app.pre_launch_wishlist_ranks, -7, -1, "wishlist_rank"),
      ...offsetValues(app.post_launch_review_counts, 0, 7, "reviews_total")
    ]);
  }

  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function makeDetails(apps) {
  const lines = [];
  for (const app of apps) {
    lines.push(`### ${escapeMd(app.name || String(app.appid))}`);
    lines.push("");
    lines.push(`- AppID: \`${app.appid}\``);
    lines.push(`- Store: ${app.store_url}`);
    lines.push(`- Release date: ${app.release_date || "unknown"}`);
    if (app.release_date_text) lines.push(`- Steam release text: ${escapeMd(app.release_date_text)}`);
    lines.push("");
    lines.push("| Date | Offset | Metric | Value | Status | Captured at |");
    lines.push("| --- | ---: | --- | ---: | --- | --- |");

    for (const item of app.pre_launch_wishlist_ranks || []) {
      lines.push(
        `| ${item.date} | ${item.day_offset} | Wishlist rank | ${formatValue(item.wishlist_rank)} | ${item.status || ""} | ${item.captured_at || ""} |`
      );
    }

    for (const item of app.post_launch_review_counts || []) {
      lines.push(
        `| ${item.date} | ${item.day_offset} | Reviews total | ${formatValue(item.reviews_total)} | ${item.reviews_total == null ? "not_collected" : "ok"} | ${item.captured_at || ""} |`
      );
    }

    lines.push("");
  }
  return lines;
}

function offsetValues(items = [], start, end, field) {
  const byOffset = new Map(items.map((item) => [item.day_offset, item]));
  const values = [];
  for (let offset = start; offset <= end; offset += 1) {
    values.push(formatValue(byOffset.get(offset)?.[field]));
  }
  return values;
}

function formatValue(value) {
  return value == null || value === "" ? "-" : String(value);
}

function escapeMd(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("[", "\\[").replaceAll("]", "\\]");
}
