const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamLaunchTracker/0.1";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }

  return res.text();
}

export async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON from ${url}: ${error.message}`);
  }
}

export function parseSteamSearchRanking(payloadOrHtml, sourceId) {
  const html =
    typeof payloadOrHtml === "string"
      ? payloadOrHtml
      : payloadOrHtml.results_html || payloadOrHtml.html || "";

  const matches = [];
  const seen = new Set();
  const appRegex = /<a[^>]+href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/([^"?#/]+)[\s\S]*?<\/a>/gi;
  let match;

  while ((match = appRegex.exec(html))) {
    const appid = Number(match[1]);
    if (!appid || seen.has(appid)) continue;
    seen.add(appid);

    const block = match[0];
    const name = decodeHtml(stripTags(
      firstMatch(block, /<span[^>]+class="title"[^>]*>([\s\S]*?)<\/span>/i) ||
        match[2].replaceAll("_", " ")
    )).trim();

    matches.push({
      source: sourceId,
      rank: matches.length + 1,
      appid,
      name
    });
  }

  return matches;
}

export async function getAppDetails(appid, { country = "US", language = "english" } = {}) {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("cc", country);
  url.searchParams.set("l", language);
  const payload = await fetchJson(url);
  const entry = payload[String(appid)];

  if (!entry?.success) {
    return { appid, ok: false, reason: "appdetails_not_success" };
  }

  const data = entry.data || {};
  const releaseDate = data.release_date || {};
  const price = data.price_overview || null;

  return {
    appid,
    ok: true,
    name: data.name || "",
    type: data.type || "",
    developers: data.developers || [],
    publishers: data.publishers || [],
    coming_soon: Boolean(releaseDate.coming_soon),
    release_date_text: releaseDate.date || "",
    required_age: data.required_age ?? null,
    is_free: Boolean(data.is_free),
    price_text: price?.final_formatted || (data.is_free ? "Free" : ""),
    initial_price_text: price?.initial_formatted || "",
    discount_percent: price?.discount_percent ?? 0,
    recommendations_total: data.recommendations?.total ?? null,
    header_image: data.header_image || "",
    store_url: `https://store.steampowered.com/app/${appid}/`
  };
}

export async function getReviewSummary(appid, { language = "all" } = {}) {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("filter", "summary");
  url.searchParams.set("language", language);
  url.searchParams.set("purchase_type", "all");
  const payload = await fetchJson(url);
  const summary = payload.query_summary || {};

  return {
    reviews_total: summary.total_reviews ?? 0,
    reviews_positive: summary.total_positive ?? 0,
    reviews_negative: summary.total_negative ?? 0,
    review_score: summary.review_score ?? null,
    review_score_desc: summary.review_score_desc || "",
    review_positive_rate:
      summary.total_reviews > 0
        ? summary.total_positive / summary.total_reviews
        : null
  };
}

export async function getCurrentPlayers(appid) {
  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/"
  );
  url.searchParams.set("appid", String(appid));
  const payload = await fetchJson(url);
  const response = payload.response || {};
  return {
    current_players: response.player_count ?? null,
    player_count_result: response.result ?? null
  };
}

export function parseReleaseDate(text, now = new Date()) {
  if (!text || /soon|tba|to be announced|coming/i.test(text)) return null;

  const normalized = text.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const monthYear = normalized.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i
  );
  if (monthYear) {
    const parsedMonth = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!Number.isNaN(parsedMonth.getTime())) return parsedMonth.toISOString().slice(0, 10);
  }

  const yearOnly = normalized.match(/\b(20\d{2})\b/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;

  const numeric = normalized.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (numeric) {
    const [, a, b, y] = numeric;
    const candidate = new Date(Number(y), Number(a) - 1, Number(b));
    if (!Number.isNaN(candidate.getTime())) return candidate.toISOString().slice(0, 10);
  }

  void now;
  return null;
}

function firstMatch(value, regex) {
  const match = value.match(regex);
  return match ? match[1] : "";
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}
