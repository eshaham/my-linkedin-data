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

function pickNumber(
  obj: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
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

function pickLargestImageUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  const obj = asRecord(value);
  if (!obj) return null;
  let bestKey: string | null = null;
  let bestSize = -1;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v !== "string" || v.trim() === "") continue;
    const m = key.match(/^(\d+)x(\d+)$/);
    const size = m && m[1] ? Number(m[1]) : 0;
    if (size > bestSize) {
      bestSize = size;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  const v = obj[bestKey];
  return typeof v === "string" ? v : null;
}

function emptyProfile(): ProfileRecord {
  return {
    linkedinUrn: null,
    linkedinId: null,
    publicIdentifier: null,
    inputUrl: null,
    firstName: null,
    lastName: null,
    headline: null,
    jobTitle: null,
    summary: null,
    currentCompanyName: null,
    currentCompanyPublicId: null,
    currentCompanyLinkedinUrl: null,
    countryCode: null,
    geoCountryName: null,
    geoLocationName: null,
    geoUrn: null,
    connectionsCount: null,
    followerCount: null,
    isVerified: null,
    premium: null,
    creator: null,
    influencer: null,
    connectionType: null,
    pictureUrl: null,
    coverImageUrl: null,
    positions: [],
    raw: null,
  };
}

function formatYearMonth(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const year = typeof obj.year === "number" ? obj.year : null;
  const month = typeof obj.month === "number" ? obj.month : null;
  if (!year) return null;
  if (!month) return String(year);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function extractPublicIdentifierFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// ============================================================================
// supreme_coder/linkedin-profile-scraper adapter
// ============================================================================

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
    locationName:
      typeof source.locationName === "string"
        ? source.locationName.trim() || null
        : null,
    description:
      typeof source.description === "string"
        ? source.description.trim() || null
        : null,
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
    const publicIdentifier =
      typeof obj.publicIdentifier === "string" && obj.publicIdentifier.trim()
        ? obj.publicIdentifier.trim()
        : null;
    const linkedinUrn =
      typeof obj.profileId === "string" && obj.profileId.trim()
        ? obj.profileId.trim()
        : null;
    const linkedinId =
      typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : null;
    if (!publicIdentifier && !linkedinUrn && !linkedinId) return null;
    const currentCompany = asRecord(obj.currentCompany);
    const out = emptyProfile();
    out.linkedinUrn = linkedinUrn;
    out.linkedinId = linkedinId;
    out.publicIdentifier = publicIdentifier;
    out.inputUrl =
      typeof obj.inputUrl === "string" ? obj.inputUrl.trim() || null : null;
    out.firstName =
      typeof obj.firstName === "string" ? obj.firstName.trim() || null : null;
    out.lastName =
      typeof obj.lastName === "string" ? obj.lastName.trim() || null : null;
    out.headline =
      typeof obj.headline === "string" ? obj.headline.trim() || null : null;
    out.jobTitle =
      typeof obj.jobTitle === "string" ? obj.jobTitle.trim() || null : null;
    out.summary =
      typeof obj.summary === "string" ? obj.summary.trim() || null : null;
    out.currentCompanyName =
      (currentCompany &&
        typeof currentCompany.name === "string" &&
        currentCompany.name.trim()) ||
      (typeof obj.companyName === "string" && obj.companyName.trim()) ||
      null;
    out.currentCompanyPublicId =
      (currentCompany &&
        typeof currentCompany.universalName === "string" &&
        currentCompany.universalName.trim()) ||
      (typeof obj.companyPublicId === "string" && obj.companyPublicId.trim()) ||
      null;
    out.currentCompanyLinkedinUrl =
      (currentCompany &&
        typeof currentCompany.url === "string" &&
        currentCompany.url.trim()) ||
      (typeof obj.companyLinkedinUrl === "string" &&
        obj.companyLinkedinUrl.trim()) ||
      null;
    out.countryCode =
      typeof obj.countryCode === "string"
        ? obj.countryCode.trim() || null
        : null;
    out.geoCountryName =
      typeof obj.geoCountryName === "string"
        ? obj.geoCountryName.trim() || null
        : null;
    out.geoLocationName =
      typeof obj.geoLocationName === "string"
        ? obj.geoLocationName.trim() || null
        : null;
    out.geoUrn =
      typeof obj.geoUrn === "string" ? obj.geoUrn.trim() || null : null;
    out.connectionsCount =
      typeof obj.connectionsCount === "number" ? obj.connectionsCount : null;
    out.followerCount =
      typeof obj.followerCount === "number" ? obj.followerCount : null;
    out.isVerified =
      typeof obj.isVerified === "boolean" ? obj.isVerified : null;
    out.premium = typeof obj.premium === "boolean" ? obj.premium : null;
    out.creator = typeof obj.creator === "boolean" ? obj.creator : null;
    out.influencer =
      typeof obj.influencer === "boolean" ? obj.influencer : null;
    out.connectionType =
      typeof obj.connectionType === "string"
        ? obj.connectionType.trim() || null
        : null;
    out.pictureUrl = pickLargestImageUrl(obj.pictureUrl);
    out.coverImageUrl = pickLargestImageUrl(obj.coverImageUrl);
    const rawPositions = Array.isArray(obj.positions) ? obj.positions : [];
    for (const entry of rawPositions) {
      out.positions.push(...parseSupremeCoderEntry(entry));
    }
    out.raw = raw;
    return out;
  },
};

// ============================================================================
// Generic flat-shaped Apify adapter (dev_fusion-style, fallback)
// ============================================================================

const URL_KEYS = [
  "linkedinUrl",
  "linkedInUrl",
  "profileUrl",
  "url",
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

function parseGenericPosition(value: unknown): ProfilePosition | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const companyName = pickString(obj, COMPANY_KEYS);
  if (!companyName) return null;
  return {
    companyName,
    title: pickString(obj, TITLE_KEYS),
    locationName: pickString(obj, ["locationName", "location"]),
    description: pickString(obj, ["description", "summary"]),
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
    const publicIdentifier =
      pickString(obj, ["publicIdentifier", "publicId", "vanityName"]) ??
      extractPublicIdentifierFromUrl(url);
    if (!url && !publicIdentifier) return null;
    const out = emptyProfile();
    out.publicIdentifier = publicIdentifier;
    out.inputUrl = url;
    out.firstName = pickString(obj, ["firstName", "first_name"]);
    out.lastName = pickString(obj, ["lastName", "last_name"]);
    out.headline = pickString(obj, ["headline"]);
    out.jobTitle = pickString(obj, ["jobTitle", "title"]);
    out.summary = pickString(obj, ["summary", "about"]);
    out.currentCompanyName = pickString(obj, ["companyName", "company"]);
    out.countryCode = pickString(obj, ["countryCode"]);
    out.geoCountryName = pickString(obj, ["geoCountryName", "country"]);
    out.geoLocationName = pickString(obj, [
      "geoLocationName",
      "location",
      "addressWithCountry",
    ]);
    out.connectionsCount = pickNumber(obj, ["connectionsCount", "connections"]);
    out.followerCount = pickNumber(obj, ["followerCount", "followers"]);
    const experiences = pickArray(obj, EXPERIENCE_ARRAY_KEYS) ?? [];
    for (const entry of experiences) {
      const parsed = parseGenericPosition(entry);
      if (parsed) out.positions.push(parsed);
    }
    out.raw = raw;
    return out;
  },
};

export const ADAPTERS: ProfileAdapter[] = [
  supremeCoderApifyAdapter,
  genericApifyAdapter,
];

export function adapterByName(name: string): ProfileAdapter | undefined {
  return ADAPTERS.find((a) => a.name === name);
}
