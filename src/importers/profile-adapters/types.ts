export interface ProfilePosition {
  companyName: string;
  title: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  stillWorking: boolean | null;
}

export interface ProfileRecord {
  url: string;
  positions: ProfilePosition[];
}

export interface ProfileAdapter {
  name: string;
  parse(raw: unknown): ProfileRecord | null;
}
