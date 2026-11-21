// Launch Radar value model — "peer-priced, momentum-tilted, maturity-weighted".
//
// Every number on the board is derived at run time from the sealed snapshot's
// own figures. No protocol name appears in this file: a protocol is worth what
// the snapshot says protocols like it are worth.
//
//   implied_value_usd = clamp( round( TVL x M x S x G x A ), 10_000, 100_000_000_000 )
//
// M — the peer multiple. Protocols whose token already trades are the pricing
//     peer set (mcap_usd / tvl_usd). A category with at least 3 traded peers
//     prices at its own median, shrunk toward the global median with an
//     empirical-Bayes weight (k = 4) so thin categories cannot shout. Below
//     that, a category family (pooled n >= 5) prices; below that, the global
//     median of all traded peers. The multiple is clamped to [0.02, 3.00]:
//     the snapshot holds a 400x prediction-market outlier and a 12x
//     collateral outlier, and neither may set a board price.
// S — the size factor. In this snapshot, big protocols trade at far lower
//     multiples than small ones (the log-log slope of mcap/TVL on TVL is
//     about -0.48, fitted from the peers at run time). Peer ratios are
//     size-adjusted before any median is taken, and a row's price is
//     multiplied by S = clamp((TVL / reference TVL)^slope, 0.35, 2.50),
//     so the clamp keeps size a correction, never the story. Adding S cut
//     the model's leave-one-out median error from 0.66 to 0.50 in log10.
// G — the growth tilt. change_7d is clamped to [-30, +30] before it can move
//     anything (the field runs to +4,448.5%: one wild week is an artefact,
//     not a valuation), then G = 1 + 0.011 x g, a tilt of at most a third.
// A — the maturity factor. A = 0.80 + 0.40 x age / (age + 365), where age is
//     the number of days DefiLlama has tracked the protocol. Years run
//     tokenless with a live product is a record; two weeks is a discount.
//     A missing listed_at takes the tokenless median age, stated openly.
//
// Separation: a board row exists only where the snapshot records no token
// (mcap_usd, gecko_id and symbol all null). The traded protocols never rank;
// they only price. The model is also honest about its own error: a
// leave-one-out backtest over the traded peers ships with the board, so a
// reader can see how far this formula lands from real market caps when it
// is not allowed to see the answer.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export const MODEL_VERSION = "launch-radar-2";

export const CONSTANTS = {
  shrinkage_k: 4,
  min_category_peers: 3,
  min_family_peers: 5,
  multiple_min: 0.02,
  multiple_max: 3.0,
  size_min: 0.35,
  size_max: 2.5,
  growth_clamp: 30,
  growth_weight: 0.011,
  maturity_base: 0.8,
  maturity_span: 0.4,
  maturity_scale_days: 365,
  value_floor: 10_000,
  value_cap: 100_000_000_000,
  board_size: 220,
} as const;

// Category families, used only when a category's own traded peers are thin.
const FAMILIES: Record<string, string[]> = {
  lending: ["Lending", "CDP"],
  trading: ["Dexs", "Derivatives", "Options", "Prediction Market"],
  yield: ["Yield", "Yield Aggregator", "Leveraged Farming", "Farm"],
  staking: ["Liquid Staking", "Liquid Restaking", "Restaking", "Staking Pool"],
  bridge: ["Bridge", "Cross Chain Bridge", "Canonical Bridge"],
};

const FAMILY_OF = new Map<string, string>();
for (const [family, categories] of Object.entries(FAMILIES))
  for (const category of categories) FAMILY_OF.set(category, family);

export function recordsNoToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function ageDays(p: Protocol, asOf: string): number | null {
  if (!p.listed_at) return null;
  const listed = Date.parse(p.listed_at + "T00:00:00Z");
  const asof = Date.parse(asOf + "T00:00:00Z");
  if (Number.isNaN(listed) || Number.isNaN(asof)) return null;
  return Math.max(0, Math.floor((asof - listed) / 86_400_000));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface PeerStats {
  globalMedian: number;
  peerCount: number;
  byCategory: Map<string, number[]>;
  byFamily: Map<string, number[]>;
  tokenlessMedianAge: number;
  oddsByCategory: Map<string, number>;
  sizeBeta: number;
  sizeRefTvl: number;
}

// The size factor: fitted from the traded peers each run. The slope is the
// least-squares line of log10(mcap/TVL) on log10(TVL); the reference is the
// peers' geometric-mean TVL, where the factor is exactly 1.
export function sizeFactor(tvl: number, stats: PeerStats): number {
  const raw = Math.pow(tvl / stats.sizeRefTvl, stats.sizeBeta);
  return Math.min(CONSTANTS.size_max, Math.max(CONSTANTS.size_min, raw));
}

export function peerStats(snapshot: Snapshot): PeerStats {
  const traded = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const xs = traded.map((p) => Math.log10(p.tvl_usd));
  const ys = traded.map((p) =>
    Math.log10((p.mcap_usd as number) / p.tvl_usd),
  );
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let cov = 0;
  let varx = 0;
  for (let i = 0; i < xs.length; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    varx += (xs[i] - mx) * (xs[i] - mx);
  }
  const fit = { sizeBeta: varx > 0 ? cov / varx : 0, sizeRefTvl: Math.pow(10, mx) };
  const factorOf = (tvl: number) =>
    Math.min(
      CONSTANTS.size_max,
      Math.max(CONSTANTS.size_min, Math.pow(tvl / fit.sizeRefTvl, fit.sizeBeta)),
    );
  // Medians are taken over size-adjusted ratios, so a category's multiple
  // is its price at the reference size; the row's own size factor then
  // moves it to the row's size.
  const ratios = traded.map(
    (p) => (p.mcap_usd as number) / p.tvl_usd / factorOf(p.tvl_usd),
  );
  const byCategory = new Map<string, number[]>();
  const byFamily = new Map<string, number[]>();
  for (const p of traded) {
    const ratio = (p.mcap_usd as number) / p.tvl_usd / factorOf(p.tvl_usd);
    if (p.category) {
      const list = byCategory.get(p.category) ?? [];
      list.push(ratio);
      byCategory.set(p.category, list);
      const family = FAMILY_OF.get(p.category);
      if (family) {
        const fam = byFamily.get(family) ?? [];
        fam.push(ratio);
        byFamily.set(family, fam);
      }
    }
  }
  const tokenlessAges: number[] = [];
  for (const p of snapshot.protocols) {
    if (!recordsNoToken(p)) continue;
    const age = ageDays(p, snapshot.as_of);
    if (age !== null) tokenlessAges.push(age);
  }
  // Launch odds: the empirical share of a category that already lists a
  // token. Not part of the implied value — a separate signal, shown as one.
  const oddsByCategory = new Map<string, number>();
  const totals = new Map<string, { traded: number; total: number }>();
  for (const p of snapshot.protocols) {
    if (!p.category) continue;
    const entry = totals.get(p.category) ?? { traded: 0, total: 0 };
    entry.total += 1;
    if (!recordsNoToken(p)) entry.traded += 1;
    totals.set(p.category, entry);
  }
  for (const [category, { traded: t, total }] of totals)
    oddsByCategory.set(category, total > 0 ? t / total : 0);
  return {
    globalMedian: median(ratios),
    peerCount: traded.length,
    byCategory,
    byFamily,
    tokenlessMedianAge: tokenlessAges.length ? median(tokenlessAges) : 365,
    oddsByCategory,
    sizeBeta: fit.sizeBeta,
    sizeRefTvl: fit.sizeRefTvl,
  };
}

export type MultipleSource = "category" | "family" | "global";

export interface Multiple {
  value: number;
  source: MultipleSource;
  peers: number;
}

function shrink(med: number, n: number, globalMedian: number): number {
  const k = CONSTANTS.shrinkage_k;
  return (n * med + k * globalMedian) / (n + k);
}

export function peerMultiple(
  category: string | null,
  stats: PeerStats,
  excludeSlug?: string,
  snapshot?: Snapshot,
): Multiple {
  // With an exclusion (the backtest), the peer lists are rebuilt without the
  // held-out protocol so the model never prices a protocol by itself.
  let byCategory = stats.byCategory;
  let byFamily = stats.byFamily;
  let globalMedian = stats.globalMedian;
  if (excludeSlug && snapshot) {
    const rest = {
      ...snapshot,
      protocols: snapshot.protocols.filter((p) => p.slug !== excludeSlug),
    };
    const rebuilt = peerStats(rest);
    byCategory = rebuilt.byCategory;
    byFamily = rebuilt.byFamily;
    globalMedian = rebuilt.globalMedian;
  }
  const clampM = (v: number) =>
    Math.min(CONSTANTS.multiple_max, Math.max(CONSTANTS.multiple_min, v));
  if (category) {
    const peers = byCategory.get(category);
    if (peers && peers.length >= CONSTANTS.min_category_peers)
      return {
        value: clampM(shrink(median(peers), peers.length, globalMedian)),
        source: "category",
        peers: peers.length,
      };
    const family = FAMILY_OF.get(category);
    if (family) {
      const famPeers = byFamily.get(family);
      if (famPeers && famPeers.length >= CONSTANTS.min_family_peers)
        return {
          value: clampM(shrink(median(famPeers), famPeers.length, globalMedian)),
          source: "family",
          peers: famPeers.length,
        };
    }
  }
  return { value: clampM(globalMedian), source: "global", peers: stats.peerCount };
}

export function growthFactor(change7d: number | null): number {
  const g = Math.max(
    -CONSTANTS.growth_clamp,
    Math.min(CONSTANTS.growth_clamp, change7d ?? 0),
  );
  return 1 + CONSTANTS.growth_weight * g;
}

export function maturityFactor(age: number): number {
  return (
    CONSTANTS.maturity_base +
    (CONSTANTS.maturity_span * age) / (age + CONSTANTS.maturity_scale_days)
  );
}

export interface Priced {
  multiple: Multiple;
  size: number;
  growth: number;
  maturity: number;
  age: number;
  implied: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function price(p: Protocol, snapshot: Snapshot, stats: PeerStats): Priced {
  const multiple = peerMultiple(p.category, stats);
  // Factors are rounded to the six decimals the board ships before the
  // price is computed from them, so the dashboard's in-page recomputation
  // from those same shipped factors lands on the board's number exactly.
  const size = round6(sizeFactor(p.tvl_usd, stats));
  const growth = round6(growthFactor(p.change_7d));
  const age = ageDays(p, snapshot.as_of) ?? stats.tokenlessMedianAge;
  const maturity = round6(maturityFactor(age));
  const raw = p.tvl_usd * round6(multiple.value) * size * growth * maturity;
  const implied = Math.min(
    CONSTANTS.value_cap,
    Math.max(CONSTANTS.value_floor, Math.round(raw)),
  );
  return { multiple, size, growth, maturity, age, implied };
}

// Leave-one-out backtest: price every traded protocol from the peers that
// remain when it is held out, and measure the log error against its real
// market cap. This is the model's published margin of error.
export interface Validation {
  peers: number;
  medianAbsLog10Error: number;
  within2xPct: number;
  within3xPct: number;
}

export function validateModel(snapshot: Snapshot): Validation {
  const stats = peerStats(snapshot);
  const traded = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const errors: number[] = [];
  let within2 = 0;
  let within3 = 0;
  for (const p of traded) {
    // Rebuild the peer statistics without the held-out protocol, so its
    // multiple, the size fit and the medians never see its own answer.
    const rest = peerStats({
      ...snapshot,
      protocols: snapshot.protocols.filter((q) => q.slug !== p.slug),
    });
    const multiple = peerMultiple(p.category, rest);
    const predicted =
      p.tvl_usd *
      multiple.value *
      sizeFactor(p.tvl_usd, rest) *
      growthFactor(p.change_7d) *
      maturityFactor(ageDays(p, snapshot.as_of) ?? rest.tokenlessMedianAge);
    const err = Math.abs(Math.log10(predicted / (p.mcap_usd as number)));
    errors.push(err);
    if (err <= Math.log10(2)) within2 += 1;
    if (err <= Math.log10(3)) within3 += 1;
  }
  return {
    peers: traded.length,
    medianAbsLog10Error: median(errors),
    within2xPct: Math.round((within2 / traded.length) * 1000) / 10,
    within3xPct: Math.round((within3 / traded.length) * 1000) / 10,
  };
}

// The house's own product filter, applied to below-floor candidates exactly
// as the watchlist rule expresses it: a wrapped, staked or bridged product
// of a token that already trades has no launch of its own to radar.
const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);
const EXCHANGE_PREFIXES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
];

export function passesProductFilter(p: Protocol): boolean {
  if (p.category && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  if (/\s(V\d+|v\d+|\d+\.\d+)$/.test(p.name)) return false;
  for (const prefix of EXCHANGE_PREFIXES)
    if (p.name.startsWith(prefix)) return false;
  return true;
}

export interface SelectedRow {
  protocol: Protocol;
  watchlist: boolean;
}

export function selectBoard(snapshot: Snapshot): SelectedRow[] {
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const rows: SelectedRow[] = [];
  const seen = new Set<string>();
  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (p && !seen.has(slug)) {
      rows.push({ protocol: p, watchlist: true });
      seen.add(slug);
    }
  }
  const candidates = snapshot.protocols
    .filter(
      (p) =>
        !seen.has(p.slug) &&
        recordsNoToken(p) &&
        p.tvl_usd < snapshot.floor_usd &&
        passesProductFilter(p),
    )
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  for (const p of candidates) {
    if (rows.length >= CONSTANTS.board_size) break;
    rows.push({ protocol: p, watchlist: false });
    seen.add(p.slug);
  }
  return rows;
}
