export interface ProfilePosition {
  companyName: string;
  title: string | null;
  locationName: string | null;
  description: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  stillWorking: boolean | null;
}

export interface ProfileRecord {
  linkedinUrn: string | null;
  linkedinId: string | null;
  publicIdentifier: string | null;
  inputUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  jobTitle: string | null;
  summary: string | null;
  currentCompanyName: string | null;
  currentCompanyPublicId: string | null;
  currentCompanyLinkedinUrl: string | null;
  countryCode: string | null;
  geoCountryName: string | null;
  geoLocationName: string | null;
  geoUrn: string | null;
  connectionsCount: number | null;
  followerCount: number | null;
  isVerified: boolean | null;
  premium: boolean | null;
  creator: boolean | null;
  influencer: boolean | null;
  connectionType: string | null;
  pictureUrl: string | null;
  coverImageUrl: string | null;
  positions: ProfilePosition[];
  raw: unknown;
}

export interface ProfileAdapter {
  name: string;
  parse(raw: unknown): ProfileRecord | null;
}
