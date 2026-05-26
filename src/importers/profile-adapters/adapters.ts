import type {
  ProfileAdapter,
  ProfilePosition,
  ProfileRecord,
} from "./types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function pickBoolean(
  obj: Record<string, unknown>,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "boolean") return v;
  }
  return null;
}

function pickArray(
  obj: Record<string, unknown>,
  keys: readonly string[],
): unknown[] | null {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

const URL_KEYS = [
  "url",
  "linkedinUrl",
  "linkedInUrl",
  "profileUrl",
  "inputUrl",
] as const;

const EXPERIENCE_ARRAY_KEYS = [
  "experiences",
  "experience",
  "positions",
  "workHistory",
  "employmentHistory",
] as const;

const COMPANY_KEYS = [
  "companyName",
  "company",
  "companyTitle",
  "organisationName",
] as const;

const TITLE_KEYS = ["title", "jobTitle", "position", "role"] as const;

const STARTED_KEYS = [
  "jobStartedOn",
  "startedOn",
  "startDate",
  "from",
  "starts_at",
  "startsAt",
] as const;

const FINISHED_KEYS = [
  "jobEndedOn",
  "finishedOn",
  "endDate",
  "to",
  "ends_at",
  "endsAt",
] as const;

const STILL_WORKING_KEYS = [
  "jobStillWorking",
  "stillWorking",
  "current",
  "isCurrent",
] as const;

function parsePosition(value: unknown): ProfilePosition | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const companyName = pickString(obj, COMPANY_KEYS);
  if (!companyName) return null;
  return {
    companyName,
    title: pickString(obj, TITLE_KEYS),
    startedOn: pickString(obj, STARTED_KEYS),
    finishedOn: pickString(obj, FINISHED_KEYS),
    stillWorking: pickBoolean(obj, STILL_WORKING_KEYS),
  };
}

export const genericApifyAdapter: ProfileAdapter = {
  name: "generic-apify",
  parse(raw: unknown): ProfileRecord | null {
    const obj = asRecord(raw);
    if (!obj) return null;
    const url = pickString(obj, URL_KEYS);
    if (!url) return null;
    const experiences = pickArray(obj, EXPERIENCE_ARRAY_KEYS) ?? [];
    const positions: ProfilePosition[] = [];
    for (const entry of experiences) {
      const parsed = parsePosition(entry);
      if (parsed) positions.push(parsed);
    }
    return { url, positions };
  },
};

function formatYearMonth(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const year = typeof obj.year === "number" ? obj.year : null;
  const month = typeof obj.month === "number" ? obj.month : null;
  if (!year) return null;
  if (!month) return String(year);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildSupremeCoderPosition(
  companyName: string,
  source: Record<string, unknown>,
): ProfilePosition {
  const timePeriod = asRecord(source.timePeriod);
  const startedOn = timePeriod ? formatYearMonth(timePeriod.startDate) : null;
  const finishedOn = timePeriod ? formatYearMonth(timePeriod.endDate) : null;
  const stillWorking = timePeriod
    ? timePeriod.endDate === null || timePeriod.endDate === undefined
    : null;
  return {
    companyName,
    title: typeof source.title === "string" ? source.title.trim() : null,
    startedOn,
    finishedOn,
    stillWorking,
  };
}

function parseSupremeCoderEntry(value: unknown): ProfilePosition[] {
  const obj = asRecord(value);
  if (!obj) return [];
  const company = asRecord(obj.company);
  const companyName =
    (company && typeof company.name === "string" && company.name.trim()) ||
    null;
  if (!companyName) return [];
  const nested = Array.isArray(obj.positions) ? obj.positions : null;
  if (nested && nested.length > 0) {
    const out: ProfilePosition[] = [];
    for (const child of nested) {
      const childObj = asRecord(child);
      if (childObj) out.push(buildSupremeCoderPosition(companyName, childObj));
    }
    return out;
  }
  return [buildSupremeCoderPosition(companyName, obj)];
}

export const supremeCoderApifyAdapter: ProfileAdapter = {
  name: "apify:supreme_coder",
  parse(raw: unknown): ProfileRecord | null {
    const obj = asRecord(raw);
    if (!obj) return null;
    const publicId =
      typeof obj.publicIdentifier === "string"
        ? obj.publicIdentifier.trim()
        : null;
    if (!publicId) return null;
    const url = `https://www.linkedin.com/in/${publicId}`;
    const rawPositions = Array.isArray(obj.positions) ? obj.positions : [];
    const positions: ProfilePosition[] = [];
    for (const entry of rawPositions) {
      positions.push(...parseSupremeCoderEntry(entry));
    }
    return { url, positions };
  },
};

export const ADAPTERS: ProfileAdapter[] = [
  supremeCoderApifyAdapter,
  genericApifyAdapter,
];

export function adapterByName(name: string): ProfileAdapter | undefined {
  return ADAPTERS.find((a) => a.name === name);
}
