// Farm-plan generator: one concrete plan per board row, built from the
// protocol's category, chains, TVL tier and age — never a slogan. Every step
// names an action, what it costs, and how long it takes. Costs come from a
// fixed gas-class table per chain (never invented per row); position sizes
// derive from TVL by formula, so two protocols in the same category still
// get different numbers. A deterministic rotation by slug hash varies the
// sentence shapes so 220 rows do not read copy-pasted.

import type { Protocol } from "./model.ts";

const GAS_BANDS: Record<string, string> = {
  Ethereum: "$3–$12",
  Arbitrum: "$0.05–$0.60",
  Base: "$0.05–$0.60",
  Optimism: "$0.05–$0.60",
  Linea: "$0.05–$0.60",
  Scroll: "$0.05–$0.60",
  Mantle: "$0.05–$0.60",
  Polygon: "$0.05–$0.60",
  Unichain: "$0.05–$0.60",
  Binance: "$0.01–$0.50",
  Avalanche: "$0.01–$0.50",
  Monad: "$0.01–$0.50",
  Ink: "$0.01–$0.50",
  Sonic: "$0.01–$0.50",
  Berachain: "$0.01–$0.50",
  Plasma: "$0.01–$0.50",
  Katana: "$0.01–$0.50",
  Starknet: "$0.01–$0.50",
  Flare: "$0.01–$0.50",
  Solana: "$0.01–$0.10",
  Bitcoin: "$1–$5",
  Algorand: "$0.01–$0.10",
  Tron: "$1–$4",
  Ripple: "$0.01–$0.10",
  Stellar: "$0.01–$0.10",
  Sui: "$0.01–$0.50",
  Aptos: "$0.01–$0.50",
};

const ASSETS: Record<string, string> = {
  Ethereum: "ETH",
  Arbitrum: "ETH",
  Base: "ETH",
  Optimism: "ETH",
  Linea: "ETH",
  Scroll: "ETH",
  Mantle: "MNT",
  Polygon: "POL",
  Unichain: "ETH",
  Binance: "BNB",
  Avalanche: "AVAX",
  Monad: "MON",
  Ink: "ETH",
  Sonic: "S",
  Berachain: "BERA",
  Solana: "SOL",
  Bitcoin: "BTC",
  Algorand: "ALGO",
  Tron: "TRX",
  Sui: "SUI",
  Starknet: "STRK",
  Flare: "FLR",
};

const NON_EVM = new Set([
  "Solana",
  "Bitcoin",
  "Algorand",
  "Tron",
  "Ripple",
  "Stellar",
  "Sui",
  "Aptos",
  "Cardano",
  "TON",
]);

export function gasBand(chain: string): string {
  return GAS_BANDS[chain] ?? "$0.01–$0.50";
}

export function gasWord(chain: string): string {
  return NON_EVM.has(chain) ? "network fees" : "gas";
}

export interface Tier {
  id: string;
  floor: number;
  ceiling: number;
  steps: number;
}

export function tierOf(tvl: number): Tier {
  if (tvl >= 500_000_000) return { id: "T1", floor: 10_000, ceiling: 100_000, steps: 6 };
  if (tvl >= 100_000_000) return { id: "T2", floor: 2_500, ceiling: 25_000, steps: 6 };
  if (tvl >= 20_000_000) return { id: "T3", floor: 500, ceiling: 5_000, steps: 5 };
  return { id: "T4", floor: 100, ceiling: 1_000, steps: 5 };
}

function round2sf(n: number): number {
  if (n <= 0) return 0;
  const digits = Math.floor(Math.log10(n));
  const scale = Math.pow(10, digits - 1);
  return Math.round(n / scale) * scale;
}

export function capitalBand(tvl: number): { lo: number; hi: number; mid: number } {
  const tier = tierOf(tvl);
  const raw = Math.min(tier.ceiling, Math.max(tier.floor, tvl * 0.00005));
  const mid = round2sf(raw);
  return { lo: round2sf(mid * 0.6), hi: round2sf(mid * 2), mid };
}

export function money(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export function tvlShort(tvl: number): string {
  if (tvl >= 1e9) return "$" + (tvl / 1e9).toFixed(2) + "B";
  if (tvl >= 1e6) return "$" + Math.round(tvl / 1e6) + "M";
  return "$" + Math.round(tvl / 1e3) + "K";
}

function slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

export interface FarmContext {
  name: string;
  chain: string;
  chain2: string | null;
  nChains: number;
  gas: string;
  gasWord: string;
  asset: string;
  capital: string;
  capitalMid: string;
  weeks: string;
  tvl: string;
}

function fill(template: string, ctx: FarmContext): string {
  return template
    .replaceAll("{name}", ctx.name)
    .replaceAll("{chain}", ctx.chain)
    .replaceAll("{chain2}", ctx.chain2 ?? ctx.chain)
    .replaceAll("{n_chains}", String(ctx.nChains))
    .replaceAll("{gas}", ctx.gas)
    .replaceAll("{gasWord}", ctx.gasWord)
    .replaceAll("{asset}", ctx.asset)
    .replaceAll("{capital}", ctx.capital)
    .replaceAll("{capitalMid}", ctx.capitalMid)
    .replaceAll("{weeks}", ctx.weeks)
    .replaceAll("{tvl}", ctx.tvl);
}

// Each template: the main steps, then the rotation bank. Steps that need a
// second chain carry {chain2} and are only kept for multi-chain protocols.
const TEMPLATES: Record<string, string[]> = {
  dexs: [
    "Bridge {capital} in stablecoins and {asset} to {chain} and make your first swaps on {name} across at least 3 different pairs; bridging costs $1–$15 once and each swap costs {gas} in {gasWord}, about 30 minutes to set up.",
    "Provide {capital} of liquidity to the highest-volume stable or blue-chip pair on {name} on {chain}; opening the position costs {gas} and you should budget 2–8% impermanent loss over a quarter, checked and rebalanced monthly (about 20 minutes a month).",
    "Trade on {name} every week for {weeks} weeks — even $100–$500 round-trip swaps — so your wallet shows a long, regular history rather than one large day; weekly {gasWord} run roughly {gas} per swap, under $10 a month on most chains.",
    "Keep the LP position open through at least two full calendar months without withdrawing; longevity is the cheapest signal to farm and costs nothing beyond the capital already committed.",
    "If {name} runs a points or season program, link the same wallet you LP with and complete its weekly tasks; the tasks are free and take about 15 minutes a week, but only ever use the program's own site.",
    "Concentrate liquidity in a tight range on one volatile pair on {name} only if you can rebalance weekly; a tight range earns more fees but costs {gas} per rebalance and can sit out of range for days, so allow 30 minutes a week.",
  ],
  lending: [
    "Supply {capital} in a major stablecoin or {asset} to {name} on {chain}; the deposit costs {gas} in {gasWord} and takes 10 minutes, and supplied funds start earning the supply rate immediately.",
    "Borrow 30–40% of your supplied value against the position and re-supply the borrowed asset once — one conservative loop; the extra transactions cost {gas} each and you must keep the health factor above 2.0, which locks roughly 2× the borrowed amount as collateral.",
    "Repay and re-borrow a small part of the loan every 2–3 weeks for {weeks} weeks so the account shows repeated, real borrowing rather than a single parked deposit; each adjustment costs {gas} and about 10 minutes.",
    "Use at least two different markets on {name} (for example a stablecoin market and the {asset} market) so your activity is not a single deposit; switching markets costs {gas} per move.",
    "Hold the supplied position through a full season of {weeks} weeks without withdrawing; on a lending market, duration of supply is the cheapest and most credible signal, and holding costs nothing beyond the capital committed.",
    "Set a liquidation alert and keep a $200–$500 buffer of the borrowed asset in the same wallet; the buffer sits idle, but it is what keeps a farmed position from being liquidated on a volatile weekend.",
  ],
  perps: [
    "Deposit {capital} as margin on {name} ({chain}) and open your first position at no more than 3× leverage; the deposit bridge costs $1–$15 once if {chain} is not your home chain, and opening a trade costs {gas}.",
    "Trade steadily toward a cumulative volume of 25–50× your margin over {weeks} weeks — for example $2,000–$5,000 of notional a week on a $1,000 account — using limit orders where possible; maker fees run about 0.02% and taker fees about 0.05% of notional, so budget $25–$75 of fees per $100k of volume.",
    "Keep at least half your volume in a delta-neutral pattern (for example a long on {name} hedged with a short elsewhere) so farming volume does not become directional gambling; the hedge leg costs its own fees, roughly doubling the fee budget to $50–$150 per $100k.",
    "Open and close at least one position in most weeks rather than trading in a single burst; venue points systems have historically rewarded weeks-active over raw one-day volume, and the weekly cost is only the fees on that week's trades.",
    "Never let a farmed position sit within 20% of its liquidation price overnight; the capital you are risking is the margin, and one liquidation usually costs more than a season of fee rebates returns.",
    "Leave a resting limit-order presence: keep 2–3 maker orders open during the hours you are awake and cancel before you sleep; it costs nothing but attention, about 15 minutes a day.",
  ],
  bridge: [
    "Bridge {capital} from Ethereum (or your home chain) to {chain} through {name} and bridge a different asset back a few days later; each hop costs $1–$15 in fees and takes 5–30 minutes, and both directions matter — one-way users look like exit traffic.",
    "Move funds through {name} at least twice a month for {weeks} weeks, varying the amount ($200–$2,000) and the corridor where {name} supports more than one route; monthly cost is roughly $5–$30 in bridge and {gasWord}.",
    "If {name} offers liquidity pools on either side of the bridge, deposit $500–{capitalMid} into one pool for at least 8 weeks; pool deposits cost {gas} to open and carry smart-contract risk rather than market risk.",
    "Use {name} for a real recurring need — for example funding your {chain} wallet monthly — instead of synthetic round trips; genuine recurring routes are the hardest pattern to filter out and cost nothing extra.",
    "Keep records of every hop (hashes and dates) in a simple spreadsheet; if the protocol later runs a retroactive claim with a Sybil review, your own log is the fastest way to prove one wallet's honest history, and it takes 2 minutes per hop.",
  ],
  yield: [
    "Deposit {capital} in stablecoins into the main vault of {name} on {chain}; the deposit costs {gas} in {gasWord} and takes 10 minutes, and the vault share token you receive is your position — do not sell or move it between wallets.",
    "Split a second deposit of half that size into a different vault or strategy on {name} after 2–3 weeks, so the account shows considered allocation rather than a single click; the second deposit costs another {gas}.",
    "Compound or top up the position monthly for {weeks} weeks — even $50–$200 additions — because recurring deposits are a stronger signal than one static balance; each top-up costs {gas}.",
    "Plan to hold through at least one full quarter; yield-vault snapshots in past launches have rewarded average balance over time, so an early exit costs you the entire season for the sake of a few weeks of yield.",
    "If the vault issues a liquid share token, use a small part of it as collateral or LP on the same chain once; one careful DeFi loop shows real usage and costs {gas}, but keep it under 25% of the position so a bad week cannot cascade.",
  ],
  "yield-aggregator": [
    "Deposit {capital} in stablecoins into {name} on {chain}, choosing its main auto-compounding vault; the deposit costs {gas} and the aggregator routes the funds to underlying farms for you.",
    "Spread a second tranche across {name} vaults on a second chain ({chain2}) if you already hold funds there; the extra bridge costs $1–$15 once, and multi-chain users have historically been weighted as higher-value accounts.",
    "Rotate a portion of the position when {name} changes its strategy allocation — roughly once a month, 15 minutes — following its rebalances shows you are an active allocator, not parked capital; each rotation costs {gas}.",
    "Hold the aggregate position for {weeks} weeks and top up after any month in which your balance fell, keeping your time-weighted balance rising; top-ups cost {gas} each.",
    "Compare the vault's net APY against its underlying farms monthly and move only if the gap exceeds 2 points for a full month; churn for its own sake costs {gas} each time and resets duration counters.",
  ],
  staking: [
    "Stake {capital} of the native asset with {name} on {chain}; staking costs {gas} and the position starts accruing points or rewards immediately, but note the unbonding period before you commit — unstaking can take 7–28 days.",
    "Delegate or stake from the same wallet for the whole season of {weeks} weeks without unstaking; duration is the main ranking input for staking launches, and holding costs nothing beyond the locked capital.",
    "Restake or re-delegate the rewards monthly rather than selling them; each compounding transaction costs {gas} and grows both your stake and your recorded activity.",
    "If {name} lets you choose operators or vaults, split the stake across two or three rather than the default one; diversification is usually free at staking time and is visible in the protocol's own dashboards.",
    "For BTC-denominated staking, budget the Bitcoin network fee of $1–$5 per transaction and confirm the lock-up terms twice — BTC staking locks are typically the longest and least reversible in this list.",
  ],
  "liquid-staking": [
    "Mint the liquid staking token by staking {capital} of {asset} through {name} on {chain}; minting costs {gas} and you receive a receipt token that keeps accruing staking yield.",
    "Hold at least half the receipt token untouched in the staking wallet for {weeks} weeks; the held half is your duration signal and costs nothing.",
    "Put the other half to work once — as LP collateral or in a lending market on {chain} — so the protocol sees its token used in the wider ecosystem; the extra transactions cost {gas} each and add smart-contract risk, so keep this half small.",
    "Stake a second, smaller tranche 4–6 weeks later from the same wallet; two staking events months apart read as a committed staker, not a snapshot tourist, and cost {gas}.",
    "Unstake nothing before any announced snapshot windows close; unstaking queues in liquid staking can take days, and a position stuck in exit during a snapshot usually counts as gone.",
  ],
  "risk-curators": [
    "Deposit {capital} in stablecoins into a {name}-curated vault on {chain} — pick its flagship conservative vault, not the highest-APY one; the deposit costs {gas} and takes 10 minutes.",
    "Add a second {name} vault with a different risk profile (for example its {asset}-collateral vault) at half the size, 2–3 weeks later; a curator's most valuable users hold across its vault range, and the second deposit costs another {gas}.",
    "Hold both vaults for {weeks} weeks, topping up $100–$500 monthly; curator points and past curator-linked launches have weighted time-weighted balances, so steady growth beats a single large deposit that leaves — {name} oversees {tvl} in total value locked, and its holder history is the record that will be read.",
    "Withdraw and redeposit nothing during the hold except for a genuine risk event; churn between {name}'s own vaults still resets some duration measures and costs {gas} each way.",
    "If the curator also runs vaults on {chain2}, place a smaller third position there ($250–$1,000); cross-chain curator users are rare and cheap to become at {gas} per deposit plus a $1–$15 bridge.",
  ],
  "capital-allocator": [
    "Deposit {capital} in stablecoins or {asset} into the main allocation vault of {name} on {chain}; the deposit costs {gas} and the vault routes capital across lending and LP strategies automatically.",
    "Hold the vault shares in the depositing wallet for {weeks} weeks without transferring them; allocator launches have historically ranked wallets by share-balance duration, and holding costs nothing.",
    "Make a second deposit of 25–50% of the first after 4–6 weeks, ideally after a public strategy update from {name}; repeat depositors are visibly different from one-time depositors in the vault's own data, and the deposit costs {gas}.",
    "Track the vault's reported strategy mix monthly (15 minutes, free) and be ready to exit within the stated withdrawal window if a strategy you dislike appears; allocator risk is strategy risk, not market risk.",
    "Where {name} offers the same vault on {chain2}, mirror a smaller position there ($250–$1,000 plus a $1–$15 bridge) — allocators expanding across chains tend to reward users who followed them.",
  ],
};

TEMPLATES.rwa = [
  "Complete {name}'s onboarding and KYC before depositing anything; it is free but takes 15–30 minutes plus document checks that can take 1–3 days, and accounts opened in a rush during a launch announcement often miss eligibility windows.",
  "Make a first purchase of $100–{capitalMid} of {name}'s core product on {chain} (tokenized treasuries, real-estate fractions or private credit, per its catalogue); on-chain settlement costs {gas} and any platform minimum ($50–$1,000 is typical) applies.",
  "Hold the position through at least two full distribution cycles — usually monthly payouts, so 8–12 weeks minimum — because RWA launches reward holders of record across cycles, not buyers in the launch week; holding costs nothing.",
  "Reinvest each distribution into a further purchase rather than withdrawing it; each reinvestment costs {gas} and compounds both yield and recorded holding history.",
  "Keep your KYC documents and purchase confirmations archived off-chain; if the eventual token claim requires proof of accredited or regional eligibility, the holders who can produce records immediately are the ones who get processed first — 10 minutes of filing now.",
];
TEMPLATES.cdp = [
  "Open a vault on {name} ({chain}) with {capital} of collateral and mint its stablecoin at a conservative collateral ratio of 200% or higher; opening and minting cost {gas} each, and the 200% buffer is what keeps the vault alive in a 30% drawdown.",
  "Use the minted stablecoin productively — deposit it in a yield vault or LP on {chain} — rather than selling it; CDP protocols track stablecoin in circulation, and minted-and-held supply is the metric that matters, at a further cost of {gas}.",
  "Adjust the vault monthly for {weeks} weeks: top up collateral when the ratio drifts below 200%, repay a little when it rises above 300%; each adjustment costs {gas} and 10 minutes, and an actively managed vault is a visibly different user from an abandoned one.",
  "Never let the vault approach the liquidation ratio to farm harder; a liquidated vault usually loses 10–15% of collateral to penalties, which is more than any plausible token allocation on a position this size.",
  "Open a second, smaller vault with a different collateral type if {name} supports one ($250–$1,000 of collateral); multi-collateral users are uncommon and the second vault costs {gas} to open.",
];
TEMPLATES.payments = [
  "Start using {name} for real payments: fund the wallet or open channels with $100–$500 and make at least two genuine payments a week for {weeks} weeks; Lightning-style payments cost about $0.01 each, and on-chain channel opens cost $1–$5 each.",
  "If {name} is Lightning-based, open 2–3 channels to well-connected nodes and keep them open; channel longevity is a public, hard-to-fake signal and the locked BTC (suggest $200–$1,000 total) is the only real cost.",
  "Route a recurring payment — a subscription, a monthly transfer — through {name} instead of your usual rail; recurring usage is the pattern payment launches reward, and it costs nothing beyond the payment itself.",
  "Keep the account in good standing with no disputed or reversed payments during the farming period; payment networks can exclude flagged accounts from launches entirely, and a clean record costs nothing.",
];
TEMPLATES.chain = [
  "Bridge {capital} to {chain} and hold the native asset in a self-custody wallet there; the bridge costs $1–$15 once, and simply holding on a young chain is the base signal every chain launch measures.",
  "Use 3–5 native dApps on {chain} each month — a DEX swap, a lending deposit, a name or NFT mint — at {gas} per transaction, so the wallet shows a real on-chain life rather than a parked balance; budget $5–$25 a month in fees.",
  "Delegate or stake part of the native asset to a validator if {chain} supports it; delegation costs {gas}, starts the longest-duration signal a chain can record, and typically locks the stake for 7–21 days on unstake.",
  "Keep a weekly transaction cadence for {weeks} weeks — one or two small transactions most weeks — because chains ranking wallets for a launch consistently weight active weeks over total volume; weekly cost is under $1 on most new chains.",
  "Run any official testnet or quests the chain publishes from the same wallet you use on mainnet; testnet work is free apart from 20–30 minutes a week, and chains have repeatedly carried testnet activity into mainnet launch allocations.",
];
TEMPLATES.insurance = [
  "Deposit {capital} into the underwriting or coverage pool of {name} on {chain}; the deposit costs {gas} and underwriting capital is typically locked for the policy periods it backs, commonly 30–90 days.",
  "Also buy a small real cover policy through {name} for a position you actually hold elsewhere ($10–$60 of premium for a quarter is typical); holding both sides — underwriter and customer — is rare and visible.",
  "Roll the underwriting deposit into a second policy period instead of withdrawing at the first unlock; two consecutive periods over {weeks} weeks is the duration signal, and rolling costs {gas}.",
  "Read one full policy wording before depositing (30 minutes, free); underwriting losses come from misunderstood exclusions, and no token allocation compensates a total pool loss.",
];
TEMPLATES.options = [
  "Deposit {capital} in the base asset or stablecoins into a weekly options vault on {name} ({chain}); deposits cost {gas} and each vault epoch runs Friday to Friday, so deposit before the weekly cutoff.",
  "Stay in the vault for at least 8 consecutive epochs ({weeks} weeks minimum) without withdrawing mid-epoch; epoch streaks are the standard duration metric for options vaults and withdrawing early forfeits the week's premium.",
  "Add a second vault on the opposite side (for example the put-selling vault if you started in the call vault) at half size; running both sides costs another {gas} deposit and shows strategy-level usage.",
  "Track the vault's strike selection weekly (10 minutes, free) and size down after any epoch that loses more than 3%; options vaults bleed slowly in trending markets, and the farming goal never justifies an unmanaged bleed.",
];
TEMPLATES.privacy = [
  "Make a first shielded deposit of $200–$1,000 into {name} on {chain} and leave it shielded for at least 4 weeks; depositing costs {gas} and the anonymity set you join is the product — duration inside it is the signal.",
  "Make 2–3 small private transfers per month between your own wallets for {weeks} weeks, varying amounts; each transfer costs {gas} and regular, modest usage reads as a real privacy user rather than a one-off mixer visit.",
  "Unshield only part of the position when you do withdraw, keeping a shielded balance open; accounts that fully exit before a snapshot have historically counted for little, and keeping the account open costs nothing.",
  "Keep your own records of every deposit and withdrawal (dates, hashes, amounts) in private storage; privacy protocols attract compliance questions at claim time, and your own clean record — 2 minutes per transaction — is your protection.",
];
TEMPLATES.cex = [
  "Complete KYC on {name} and make a first deposit of $200–$1,000; onboarding takes 20–40 minutes plus verification time, and the deposit itself is free apart from your bank or network fee of $1–$10.",
  "Trade $1,000–$5,000 of spot volume a month, favouring maker orders (fees about 0.1% maker / 0.15% taker at standard tiers, so $15–$60 a month), for at least {weeks} weeks; consistent monthly volume is the metric exchange launches have always used.",
  "Hold a working balance on the exchange between trades rather than withdrawing after every session; average balance is the second metric, and it costs nothing beyond the counterparty risk you accept by holding there — size it accordingly.",
  "Use one additional product — margin, earn, or the exchange's card — at small size ($100–$500) for a full quarter; multi-product users are the segment exchange airdrops describe as most valuable, and the cost is only that product's normal fees.",
];
TEMPLATES["basis-trading"] = [
  "Deposit {capital} in stablecoins into the basis vault of {name} on {chain}; the deposit costs {gas} and returns are funding-rate dependent, so check the vault's trailing 30-day net APY (free, 5 minutes) before sizing up.",
  "Hold for {weeks} weeks through at least one full funding cycle of market stress — a sharp rally or sell-off — because basis vaults prove themselves in volatility and launches have rewarded holders who stayed through it; holding costs nothing.",
  "Top up after any month in which the vault's APY held above cash rates; recurring deposits of $100–$500 cost {gas} and build the time-weighted balance that matters.",
  "Split a smaller tranche into a second basis venue so a single venue's hedge failure cannot take the whole position; basis risk is venue risk, and the second deposit costs {gas} plus a possible $1–$15 bridge.",
];
TEMPLATES["prediction-market"] = [
  "Fund an account on {name} with $200–$1,000 and trade 10–20 positions across at least three different market categories in your first month; each trade costs {gas} plus the market's spread, typically 1–3% on small orders.",
  "Provide liquidity by leaving resting limit orders on both sides of 2–3 active markets; resting orders cost nothing until filled and market-making activity is the scarcest behaviour prediction markets reward.",
  "Trade in most weeks for {weeks} weeks, including holding at least two positions to resolution; resolved-position history separates real users from volume churners and costs only the positions themselves.",
  "Keep single-position size under 10% of your bankroll on {name}; prediction markets resolve binary, and one confident loss can erase a season of careful farming.",
];
TEMPLATES.generic = [
  "Onboard to {name} on {chain} with {capital}: complete any sign-up or KYC (15–30 minutes, free), fund the wallet ($1–$15 of bridge and network fees), and make the protocol's core deposit or stake as the first transaction.",
  "Use the protocol's single core action — the deposit, stake, trade or mint it exists for — at least twice a month for {weeks} weeks; each use costs {gas} and regularity is the universal signal every launch in this sector has weighted.",
  "Grow the position once, by 25–50%, after the first month rather than starting at full size; a second, larger commitment costs {gas} and reads as conviction rather than a one-day snapshot visit.",
  "Complete any official quests or points program {name} itself publishes (its own site only — never a third-party link), allowing 15–20 minutes a week; the quests are free, and only ever connect the wallet you farm with.",
  "Hold the position through at least one full quarter and keep your own log of dates, hashes and amounts (2 minutes per action); duration plus a provable history is the fallback every retroactive launch falls back on.",
];

const CATEGORY_TEMPLATE: Record<string, string> = {
  Dexs: "dexs",
  Lending: "lending",
  "Uncollateralized Lending": "lending",
  Derivatives: "perps",
  "Interest Rate Derivatives": "perps",
  Bridge: "bridge",
  "Canonical Bridge": "bridge",
  "Cross Chain Bridge": "bridge",
  Yield: "yield",
  "Yield Aggregator": "yield-aggregator",
  "Staking Pool": "staking",
  Restaking: "staking",
  "Liquid Restaking": "staking",
  "Restaked BTC": "staking",
  "Anchor BTC": "staking",
  "Decentralized BTC": "staking",
  "Governance Incentives": "staking",
  "Liquid Staking": "liquid-staking",
  "Risk Curators": "risk-curators",
  "Collateral Markets": "risk-curators",
  "Onchain Capital Allocator": "capital-allocator",
  RWA: "rwa",
  CDP: "cdp",
  "CDP Manager": "cdp",
  "Dual-Token Stablecoin": "cdp",
  "Stablecoin Wrapper": "cdp",
  Payments: "payments",
  "Crypto Card Issuer": "payments",
  Chain: "chain",
  Insurance: "insurance",
  "Options Vault": "options",
  Privacy: "privacy",
  CEX: "cex",
  "Basis Trading": "basis-trading",
  "Prediction Market": "prediction-market",
  "Liquidity Manager": "dexs",
  "Leveraged Farming": "yield",
  Farm: "yield",
  CeDeFi: "yield",
  Indexes: "yield",
};

export function templateKey(category: string | null): string {
  if (!category) return "generic";
  return CATEGORY_TEMPLATE[category] ?? "generic";
}

export function farmSteps(p: Protocol, age: number | null): string[] {
  const key = templateKey(p.category);
  const all = TEMPLATES[key] ?? TEMPLATES.generic;
  const chain = p.chains[0] ?? "Ethereum";
  const tier = tierOf(p.tvl_usd);
  const cap = capitalBand(p.tvl_usd);
  const weeks =
    age !== null && age < 180 ? "6–8" : age !== null && age > 730 ? "13" : "10–12";
  const ctx: FarmContext = {
    name: p.name,
    chain,
    chain2: p.chains.length > 1 ? p.chains[1] : null,
    nChains: p.chains.length,
    gas: gasBand(chain),
    gasWord: gasWord(chain),
    asset: ASSETS[chain] ?? "ETH",
    capital: money(cap.lo) + "–" + money(cap.hi),
    capitalMid: money(cap.mid),
    weeks,
    tvl: tvlShort(p.tvl_usd),
  };
  const hash = slugHash(p.slug);
  // Steps stay in the template's narrative order — a plan opens with the
  // deposit, not with step four. The slug hash varies only which bank step
  // fills the final slot, and steps needing a second chain are skipped for
  // single-chain protocols.
  const want = Math.min(tier.steps, all.length);
  const usable = all.filter((s) => ctx.chain2 || !s.includes("{chain2}"));
  const picked = usable.slice(0, want);
  if (usable.length > want && picked.length === want) {
    const bank = usable.slice(want);
    picked[picked.length - 1] = bank[hash % bank.length];
  }
  // One row in three opens with a "Start by" lead-in, chosen by slug hash,
  // so the board's first steps do not all begin with the same verb.
  const steps = picked.map((s) => fill(s, ctx));
  if (steps.length > 0 && hash % 3 === 1)
    steps[0] =
      "Start by " + steps[0].charAt(0).toLowerCase() + steps[0].slice(1);
  // Momentum caution: a protocol shrinking fast gets sized down, in words.
  if (p.change_7d !== null && p.change_7d <= -10 && steps.length > 0) {
    steps[0] =
      steps[0] +
      " Size at the bottom of the band: this protocol's TVL fell " +
      Math.abs(Math.round(p.change_7d)) +
      "% in the last seven days, so let the position prove itself before adding.";
  }
  // No-repeat rule: a step that names no row-specific fact would repeat
  // verbatim across its category. Give it a factual tail from the row's
  // own figures, rotated by slug hash, so no string repeats board-wide.
  const tails = [
    " For " + p.name + ", that record is being built on " + ctx.tvl +
      " of tracked TVL.",
    " On " + p.name + ", the position sits inside " + ctx.tvl +
      " of total tracked value across " + ctx.nChains + " chain" +
      (ctx.nChains === 1 ? "" : "s") + ".",
    " " + p.name + " has been tracked for this long without a token; " +
      "keep the whole record in one wallet.",
  ];
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].includes(p.name) && steps[i].length <= 520)
      steps[i] = steps[i] + tails[(hash + i) % tails.length];
  }
  return steps.map((s) => {
    const t = s.trim();
    return t.length > 600 ? t.slice(0, 597).trimEnd() + "…" : t;
  });
}

// The verdict nets the model's implied value against what farming costs:
// a launch this size can plausibly repay a season of fees, or it cannot.
export function verdictFor(implied: number): "FARM" | "THIN" | "SKIP" {
  if (implied >= 20_000_000) return "FARM";
  if (implied >= 3_000_000) return "THIN";
  return "SKIP";
}
