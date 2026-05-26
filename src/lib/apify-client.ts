const API_BASE = "https://api.apify.com/v2";

const TERMINAL_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
  "TIMING-OUT",
]);

export interface ApifyRunResult {
  runId: string;
  status: string;
  datasetId: string | null;
  startedAt: string;
  finishedAt: string | null;
  itemCount: number | null;
}

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    throw new Error(
      "APIFY_TOKEN not set in env. Run `plugga setup apify --account personal` or add it to .env.",
    );
  }
  return t;
}

async function apifyJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify ${res.status} ${res.statusText} on ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function startActorRun(
  actorId: string,
  input: unknown,
): Promise<ApifyRunResult> {
  const res = await apifyJson<{
    data: {
      id: string;
      status: string;
      defaultDatasetId: string | null;
      startedAt: string;
      finishedAt: string | null;
      stats?: { resultsCount?: number };
    };
  }>(`/acts/${encodeURIComponent(actorId)}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    runId: res.data.id,
    status: res.data.status,
    datasetId: res.data.defaultDatasetId,
    startedAt: res.data.startedAt,
    finishedAt: res.data.finishedAt,
    itemCount: res.data.stats?.resultsCount ?? null,
  };
}

export async function getRun(runId: string): Promise<ApifyRunResult> {
  const res = await apifyJson<{
    data: {
      id: string;
      status: string;
      defaultDatasetId: string | null;
      startedAt: string;
      finishedAt: string | null;
      stats?: { resultsCount?: number };
    };
  }>(`/actor-runs/${runId}`);
  return {
    runId: res.data.id,
    status: res.data.status,
    datasetId: res.data.defaultDatasetId,
    startedAt: res.data.startedAt,
    finishedAt: res.data.finishedAt,
    itemCount: res.data.stats?.resultsCount ?? null,
  };
}

export async function waitForRun(
  runId: string,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onTick?: (run: ApifyRunResult) => void;
  } = {},
): Promise<ApifyRunResult> {
  const poll = options.pollIntervalMs ?? 5_000;
  const deadline = Date.now() + (options.timeoutMs ?? 30 * 60_000);
  while (true) {
    const run = await getRun(runId);
    options.onTick?.(run);
    if (TERMINAL_STATUSES.has(run.status)) return run;
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} did not finish before timeout`);
    }
    await new Promise((r) => setTimeout(r, poll));
  }
}

export async function fetchDatasetItems(datasetId: string): Promise<unknown[]> {
  const res = await fetch(
    `${API_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
    {
      headers: { Authorization: `Bearer ${token()}` },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Apify dataset fetch ${res.status} ${res.statusText}: ${body}`,
    );
  }
  return (await res.json()) as unknown[];
}
