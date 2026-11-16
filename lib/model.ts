// Token launch radar — the valuation model (radar-2).
//
// One sealed snapshot of the protocol universe in, one ranked board out. The board ranks every
// pre-token protocol the snapshot carries — the watchlist (TVL at or above the house floor) is a
// floor, never a ceiling — and keeps the protocols whose token already trades in a separate live
// list, at the market's own values, never mixed into the ranking.
//
// Implied value is what a protocol's token would be worth at launch if its record stayed as it is.
// It is derived only from the snapshot's own figures — no protocol name is ever special-cased:
//
//   implied = TVL x sector multiple x momentum x maturity x breadth x product factor
//
//   sector multiple  the share of TVL a launched token of that sector plausibly captures at a
//                    fully-diluted valuation: fee-earning sectors (Dexs, Derivatives) sit high,
//                    thin-fee sectors (Basis Trading, farms) sit low. The table is data, below,
//                    and the dashboard prints it next to the board.
//   momentum         the 7-day TVL change, clamped to [-50, +100] percent, weighted 0.6 and
//                    clamped again to [0.55, 1.60]: growth is evidence, not a jackpot.
//   maturity         0.65 + 0.35 x min(age_days, 1095) / 1095, age measured from the day
//                    DefiLlama began tracking the protocol to the snapshot's as_of day (unknown
//                    age counts as 365 days): a longer record is likelier to launch and to hold
//                    its value when it does.
//   breadth          1 + 0.04 x min(chains - 1, 6): a protocol live on more chains has more
//                    users a launch can reach.
//   product factor   0.15 when the protocol is a wrapped, staked or bridged product of an asset
//                    that already trades (the house's own watchlist screen: bridge and staking
//                    categories, wrapped/staked/staking name words, exchange prefixes). Such a
//                    protocol is a claim on someone else's token; a launch of its own would not
//                    capture the full TVL, so the radar discounts it instead of ranking a
//                    wrapped bitcoin above every real protocol. Otherwise 1.
//
// Farm plans are derived from the same record: the category picks the action, the first chain
// picks the gas note, the TVL picks the capital tier, the age picks the holding window. Every
// step carries a cost and a time, because a plan without either is a slogan.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board's rows carry it. */
export const MODEL_VERSION = 'radar-2';

/** Sector multiples: the share of TVL a launched token of the sector plausibly captures. */
export const SECTOR_MULTIPLES: Record<string, number> = {
  'Dexs': 0.6,
  'Derivatives': 0.55,
  'Prediction Market': 0.5,
  'CDP': 0.45,
  'Lending': 0.4,
  'Chain': 0.8,
  'Liquid Staking': 0.35,
  'Liquid Restaking': 0.35,
  'Restaking': 0.35,
  'Staking Pool': 0.35,
  'Bridge': 0.35,
  'Canonical Bridge': 0.35,
  'Cross Chain Bridge': 0.35,
  'RWA': 0.35,
  'Risk Curators': 0.3,
  'Onchain Capital Allocator': 0.3,
  'Yield': 0.3,
  'Yield Aggregator': 0.3,
  'CeDeFi': 0.3,
  'Dual-Token Stablecoin': 0.4,
  'Basis Trading': 0.25,
  'Farm': 0.2,
  'Leveraged Farming': 0.2,
};

/** The multiple a category the table does not name gets. */
export const DEFAULT_MULTIPLE = 0.3;

/** The discount for a wrapped, staked or bridged product of an asset that already trades. */
export const PRODUCT_FACTOR = 0.15;

/** How many live-token protocols the dashboard's Live view carries, by market cap. */
export const LIVE_ROWS = 24;

const DAY_MS = 86_400_000;

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that make a protocol a product of another asset, per the house's watchlist screen. */
const PRODUCT_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Anchor BTC',
  'Decentralized BTC',
  'Stablecoin Wrapper',
]);

/** Exchange name prefixes: a product that begins with one is the exchange's, not a launch. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * Whether the protocol is a wrapped, staked or bridged product of an asset that already trades:
 * the snapshot carries no parent field, so the screen is the house's own — category, whole-word
 * name markers and exchange prefixes, all read from the protocol's own record.
 */
export function isProductOfTradedAsset(p: SnapshotProtocol): boolean {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return true;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name === x || p.name.startsWith(`${x} `));
}

/** A whole day count from listed_at to as_of, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** The model's arithmetic for one protocol: every factor, then the implied value. */
export interface Score {
  sector_multiple: number;
  momentum_pct: number;
  momentum: number;
  maturity: number;
  breadth: number;
  product_factor: number;
  wrapped_product: boolean;
  age_days: number | null;
  implied: number;
}

/** Score one protocol from its own record alone. */
export function score(p: SnapshotProtocol, asOf: string): Score {
  const age = ageDays(asOf, p.listed_at);
  const sector = (p.category !== null ? SECTOR_MULTIPLES[p.category] : undefined) ?? DEFAULT_MULTIPLE;
  const growthPct = clamp(typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0, -50, 100);
  const momentum = clamp(1 + (growthPct / 100) * 0.6, 0.55, 1.6);
  const ageForModel = age ?? 365;
  const maturity = 0.65 + (Math.min(ageForModel, 1095) / 1095) * 0.35;
  const breadth = 1 + 0.04 * Math.min(Math.max(p.chains.length - 1, 0), 6);
  const wrapped = isProductOfTradedAsset(p);
  const product = wrapped ? PRODUCT_FACTOR : 1;
  const implied = Math.max(1, Math.round(p.tvl_usd * sector * momentum * maturity * breadth * product));
  return {
    sector_multiple: sector,
    momentum_pct: growthPct,
    momentum: round4(momentum),
    maturity: round4(maturity),
    breadth: round4(breadth),
    product_factor: product,
    wrapped_product: wrapped,
    age_days: age,
    implied,
  };
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in plain words a farmer can budget with. */
function gasNote(chain: string): string {
  if (chain === 'Ethereum') return 'about $8 in mainnet gas';
  if (chain === 'Solana') return 'a few cents in fees';
  if (chain === 'Bitcoin') return 'about $2 in network fees';
  if (chain === 'Tron') return 'about $1 in network fees';
  return 'under $1 in gas on that chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action, in the words a farmer can follow. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${n} on ${chain}; if it issues a stablecoin against collateral, mint a small amount and hold it`;
  if (c.includes('dex')) return `Provide $${capital} split between USDC and the chain's main asset in ${n}'s largest pool on ${chain}`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${n} and open one small hedged trade each week`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC through ${n} to ${chain} and put the bridged funds to work in one app there`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${n} and keep the liquid receipt token in the same wallet`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into the largest ${n} vault on ${chain} and keep the vault shares untouched`;
  if (c.includes('yield')) return `Deposit $${capital} into ${n}'s main vault on ${chain} and keep the yield-bearing shares`;
  if (c.includes('rwa')) return `Mint $${capital} of ${n}'s yield asset on ${chain} and hold it in the farming wallet`;
  if (c.includes('prediction')) return `Fund $${capital} on ${n} and take one position in its most liquid market`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and hold it`;
  if (c.includes('chain')) return `Bridge $${capital} to ${n}'s chain and use two of its native apps so the wallet has real activity there`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open`;
}

/** The category's second qualifying action: the one that separates a farmer from a passer-by. */
function secondAction(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow a small amount against the supply on ${n} and repay it a week later, so the wallet shows both sides of the market`;
  if (c.includes('dex')) return `Make two swaps a week through ${n} on ${chain}, in sizes you would trade anyway, rather than one large wash trade`;
  if (c.includes('staking') || c.includes('restak')) return `Use the receipt token once — as collateral or in a pool ${n} links to — so the position counts as activity, not parking`;
  if (p.chains.length > 1) return `Repeat the core action on ${p.chains[1]}, ${n}'s second chain, with a quarter of the capital, so the wallet is active on both`;
  return `Vote or claim once in ${n}'s own app when it offers the choice, so the wallet is on record as a user, not only a depositor`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) — never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasNote(chain);
  return [
    {
      text: `Open a fresh wallet for ${p.name} alone, write its seed phrase on paper, and fund it with $${capital} plus gas money`,
      cost: 'the gas to fund it, under $3 on most chains',
      time: '10 minutes',
    },
    {
      text: coreAction(p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction(p, chain),
      cost: `${gas} per action`,
      time: '10 minutes',
    },
    {
      text: `Repeat one qualifying action every week — a deposit, a swap, a borrow or a claim — so no week in the window is empty`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, across at least two monthly snapshots, before judging it`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check ${p.name}'s own points or rewards page every Sunday and follow only the links that page publishes`,
      cost: 'nothing to check; never pay anyone to claim for you',
      time: '5 minutes a week',
    },
    {
      text: `Log the wallet, dates, amounts and transaction hashes, and exit if the protocol's TVL falls by half or its team goes silent for a month`,
      cost: 'nothing but the log',
      time: '5 minutes, then 5 minutes a week',
    },
  ];
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token';
  watchlist: boolean;
  wrapped_product: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: Score;
  farm_steps: string[];
}

/** The dashboard's view of one row: the same figures, with the farm plan, in one place. */
export interface RadarRow extends BoardRow {}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  sector_multiples: Record<string, number>;
  default_multiple: number;
  product_factor: number;
  scanned: number;
  watchlist_size: number;
  board_size: number;
  wrapped_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The ranked board: every rankable pre-token protocol, strongest first, ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const onWatchlist = new Set(snapshot.watchlist);
  const scored = snapshot.protocols
    .filter(isRankable)
    .map((p) => ({ p, s: score(p, snapshot.as_of) }));
  scored.sort(
    (a, b) =>
      b.s.implied - a.s.implied ||
      b.p.tvl_usd - a.p.tvl_usd ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  return scored.map(({ p, s }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    watchlist: onWatchlist.has(p.slug),
    wrapped_product: s.wrapped_product,
    age_days: s.age_days,
    implied_value_usd: s.implied,
    model: s,
    farm_steps: farmSteps(p, s.age_days).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    sector_multiples: SECTOR_MULTIPLES,
    default_multiple: DEFAULT_MULTIPLE,
    product_factor: PRODUCT_FACTOR,
    scanned: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    wrapped_size: board.filter((r) => r.wrapped_product).length,
    live_size: live.length,
    rows: board,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, farm steps, values. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
