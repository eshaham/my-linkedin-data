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

export const ADAPTERS: ProfileAdapter[] = [genericApifyAdapter];

export function adapterByName(name: string): ProfileAdapter | undefined {
  return ADAPTERS.find((a) => a.name === name);
}
