// Fetches all game data files from the GitHub repo at runtime.
// Responses are cached in localStorage with a 1-hour TTL so the app
// works offline after the first load and doesn't hammer GitHub on every start.

const GITHUB_RAW =
  "https://raw.githubusercontent.com/kobayashi-maru-1/poeleveling/main/";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item) as { data: T; ts: number };
    if (Date.now() - ts < CACHE_TTL_MS) return data as T;
  } catch {}
  return null;
}

function setCached(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {} // ignore QuotaExceededError
}

async function fetchText(path: string, cacheKey: string): Promise<string> {
  const cached = getCached<string>(cacheKey);
  if (cached !== null) return cached;
  const res = await fetch(GITHUB_RAW + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${path}`);
  const text = await res.text();
  setCached(cacheKey, text);
  return text;
}

async function fetchJsonRemote<T>(path: string, cacheKey: string): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached !== null) return cached;
  const res = await fetch(GITHUB_RAW + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${path}`);
  const data = (await res.json()) as T;
  setCached(cacheKey, data);
  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch all 10 act route files in parallel. */
export function fetchRouteSources(): Promise<string[]> {
  return Promise.all(
    Array.from({ length: 10 }, (_, i) => i + 1).map((act) =>
      fetchText(
        `common/data/routes/act-${act}.txt`,
        `route:act-${act}`
      )
    )
  );
}

/** Fetch a single JSON data file from common/data/json/. */
export function fetchJsonFile<T>(name: string): Promise<T> {
  return fetchJsonRemote<T>(
    `common/data/json/${name}.json`,
    `json:${name}`
  );
}

