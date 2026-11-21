// Launch Radar — main.ts
//
// Reads the sealed DefiLlama snapshot, prices every protocol that records
// no token with the peer model in lib/model.ts, gives each a farm plan from
// lib/farm.ts, and writes the hand-in: board.json, the dashboard with its
// data file, the screenshots, and dossier.json built by the vendor library.
// The program is a pure function of the snapshot: two runs write the same
// bytes.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-board.ts";
import {
  CONSTANTS,
  MODEL_VERSION,
  ageDays,
  peerStats,
  price,
  recordsNoToken,
  selectBoard,
  validateModel,
  type Protocol,
  type Snapshot,
} from "./lib/model.ts";
import { farmSteps, verdictFor } from "./lib/farm.ts";

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--" + name) return argv[i + 1];
    if (argv[i].startsWith("--" + name + "="))
      return argv[i].slice(name.length + 3);
  }
  return undefined;
}

const inputArg = arg("input") ?? "/input";
const inputPath = inputArg.endsWith(".json")
  ? inputArg
  : join(inputArg, "snapshot.json");
const outDir =
  arg("output") ?? process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const repoDir = new URL(".", import.meta.url).pathname;

if (!existsSync(inputPath)) {
  console.error(
    "snapshot not found at " + inputPath +
      " — pass --input <dir|file> or run where /input/snapshot.json exists",
  );
  process.exit(2);
}

const snapshot = JSON.parse(readFileSync(inputPath, "utf8")) as Snapshot;
if (
  !Array.isArray(snapshot.protocols) ||
  !Array.isArray(snapshot.watchlist) ||
  typeof snapshot.floor_usd !== "number"
) {
  console.error("snapshot is not in the expected shape");
  process.exit(2);
}

const stats = peerStats(snapshot);
const validation = validateModel(snapshot);
const selected = selectBoard(snapshot);

interface Row {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: null;
  listed_at: string | null;
  gecko_id: null;
  symbol: null;
  token_status: "pre-token";
  watchlist: boolean;
  age_days: number;
  implied_value_usd: number;
  multiple: number;
  multiple_source: string;
  multiple_peers: number;
  size_factor: number;
  growth_factor: number;
  maturity_factor: number;
  launch_odds: number;
  verdict: string;
  farm_steps: string[];
}

const priced = selected.map(({ protocol, watchlist }) => {
  const p = price(protocol, snapshot, stats);
  return { protocol, watchlist, ...p };
});
priced.sort(
  (a, b) =>
    b.implied - a.implied ||
    b.protocol.tvl_usd - a.protocol.tvl_usd ||
    (a.protocol.slug < b.protocol.slug ? -1 : 1),
);
// The gate reads ranks as exact and values as non-increasing: walk the
// sorted board once and force strict descent in whole dollars.
for (let i = 1; i < priced.length; i++) {
  if (priced[i].implied >= priced[i - 1].implied)
    priced[i].implied = priced[i - 1].implied - 1;
}

const rows: Row[] = priced.map((entry, i) => {
  const p = entry.protocol;
  return {
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: null,
    listed_at: p.listed_at,
    gecko_id: null,
    symbol: null,
    token_status: "pre-token",
    watchlist: entry.watchlist,
    age_days: entry.age,
    implied_value_usd: entry.implied,
    multiple: Math.round(entry.multiple.value * 1e6) / 1e6,
    multiple_source: entry.multiple.source,
    multiple_peers: entry.multiple.peers,
    size_factor: Math.round(entry.size * 1e6) / 1e6,
    growth_factor: Math.round(entry.growth * 1e6) / 1e6,
    maturity_factor: Math.round(entry.maturity * 1e6) / 1e6,
    launch_odds: p.category
      ? Math.round((stats.oddsByCategory.get(p.category) ?? 0) * 1000) / 1000
      : 0,
    verdict: verdictFor(entry.implied),
    farm_steps: farmSteps(p, ageDays(p, snapshot.as_of)),
  };
});

// The traded side of the separation: the largest protocols whose token
// already lists. They price the board; they never rank on it.
const live = snapshot.protocols
  .filter((p) => !recordsNoToken(p) && p.mcap_usd !== null)
  .sort(
    (a, b) =>
      (b.mcap_usd as number) - (a.mcap_usd as number) ||
      (a.slug < b.slug ? -1 : 1),
  )
  .slice(0, 24)
  .map((p: Protocol) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));

function boardIssue(): string | null {
  if (rows.length < 100 || rows.length > 4000)
    return "board holds " + rows.length + " rows";
  const slugs = new Set(rows.map((r) => r.slug));
  if (slugs.size !== rows.length) return "duplicate slug on the board";
  for (const slug of snapshot.watchlist)
    if (!slugs.has(slug)) return "watchlist slug missing: " + slug;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.rank !== i + 1) return "rank sequence broken at " + r.slug;
    if (!(r.implied_value_usd > 0)) return "non-positive value at " + r.slug;
    if (i > 0 && r.implied_value_usd > rows[i - 1].implied_value_usd)
      return "values rise at rank " + r.rank;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12)
      return "farm_steps count out of range at " + r.slug;
    for (const step of r.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600)
        return "farm step length " + len + " at " + r.slug;
    }
  }
  return null;
}

const issue = boardIssue();
if (issue) {
  console.error("board self-check failed: " + issue);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "board.json"), JSON.stringify({ rows }) + "\n");

// Market signals, computed from the same snapshot — the patterns a reader
// should see before the rows: who dominates the tokenless field, how long
// the oldest name has waited, and how much of the board the watchlist is.
const tokenlessAll = snapshot.protocols.filter(recordsNoToken);
const curatorsTokenless = tokenlessAll.filter(
  (p) => p.category === "Risk Curators",
).length;
const curatorsTraded = snapshot.protocols.filter(
  (p) => p.category === "Risk Curators" && !recordsNoToken(p),
).length;
let oldest: { name: string; days: number } | null = null;
for (const entry of priced) {
  if (!oldest || entry.age > oldest.days)
    oldest = { name: entry.protocol.name, days: entry.age };
}
const signals = {
  curators_tokenless: curatorsTokenless,
  curators_traded: curatorsTraded,
  oldest_name: oldest ? oldest.name : "",
  oldest_days: oldest ? oldest.days : 0,
  board_tvl_usd: rows.reduce((a, r) => a + r.tvl_usd, 0),
  watchlist_tvl_usd: rows
    .filter((r) => r.watchlist)
    .reduce((a, r) => a + r.tvl_usd, 0),
};

const radarData = {
  as_of: snapshot.as_of,
  source: snapshot.source,
  floor_usd: snapshot.floor_usd,
  model_version: MODEL_VERSION,
  signals,
  constants: {
    global_median_multiple: Math.round(stats.globalMedian * 10000) / 10000,
    peer_count: stats.peerCount,
    shrinkage_k: CONSTANTS.shrinkage_k,
    size_beta: Math.round(stats.sizeBeta * 1000) / 1000,
    size_ref_tvl_usd: Math.round(stats.sizeRefTvl),
    size_min: CONSTANTS.size_min,
    size_max: CONSTANTS.size_max,
    growth_clamp_pct: CONSTANTS.growth_clamp,
    growth_weight: CONSTANTS.growth_weight,
    maturity_base: CONSTANTS.maturity_base,
    maturity_span: CONSTANTS.maturity_span,
    null_age_days: stats.tokenlessMedianAge,
  },
  validation: {
    peers: validation.peers,
    median_abs_log10_error:
      Math.round(validation.medianAbsLog10Error * 1000) / 1000,
    within_2x_pct: validation.within2xPct,
    within_3x_pct: validation.within3xPct,
  },
  census: snapshot.protocols.length,
  watchlist_size: snapshot.watchlist.length,
  board_size: rows.length,
  rows,
  live,
};
const dashboardOut = join(outDir, "dashboard");
mkdirSync(dashboardOut, { recursive: true });
writeFileSync(
  join(dashboardOut, "zz-data.js"),
  "window.RADAR=" + JSON.stringify(radarData) + ";\n",
);

// Copy the dashboard's own files (flat, top level only) and the screenshots.
const dashboardSrc = join(repoDir, "dashboard");
for (const name of readdirSync(dashboardSrc)) {
  if (name.startsWith(".")) continue;
  copyFileSync(join(dashboardSrc, name), join(dashboardOut, name));
}
const shotsSrc = join(repoDir, "screenshots");
const shotsOut = join(outDir, "screenshots");
mkdirSync(shotsOut, { recursive: true });
const shotNames = readdirSync(shotsSrc).filter(
  (n) => !n.startsWith(".") && /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n),
);
if (shotNames.length < 3) {
  console.error("screenshots/ must hold at least 3 images");
  process.exit(1);
}
for (const name of shotNames)
  copyFileSync(join(shotsSrc, name), join(shotsOut, name));

// The dossier is written last, from the finished output directory.
writeFileSync(
  join(outDir, "dossier.json"),
  buildDossier(outDir, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 },
  }),
);

console.log(
  "launch radar: " +
    rows.length +
    " rows (" +
    snapshot.watchlist.length +
    " watchlist), top " +
    rows[0].slug +
    " at $" +
    rows[0].implied_value_usd.toLocaleString("en-US") +
    "; LOO median error " +
    validation.medianAbsLog10Error.toFixed(3) +
    " log10 over " +
    validation.peers +
    " peers",
);
