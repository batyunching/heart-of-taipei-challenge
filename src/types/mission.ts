export type PageKey =
  | "home"
  | "peace_park"
  | "ntm_main"
  | "paleontology"
  | "taipei_station"
  | "world_friend"
  | "review_submit";

export type MissionType =
  | "photo_text"
  | "audio"
  | "station_sign"
  | "world_friend"
  | "info_card";

export interface Mission {
  id: string;
  pageKey: PageKey;
  type: MissionType;
  titleZh: string;
  titleEn: string;
  introZh: string;
  introEn: string;
  keywords: string[];
  requiredMedia: "none" | "photo" | "audio";
}

export interface ContentPage {
  key: PageKey;
  titleZh: string;
  titleEn: string;
  introZh: string;
  introEn: string;
}

export interface InterviewPrompt {
  id: string;
  label: string;
  zh: string;
  en: string;
}

export interface TeamMember {
  className: string;
  seatNumber: string;
  studentName: string;
}

export interface TeamDraft {
  teamName: string;
  passcode: string;
  memberCount: number;
  members: TeamMember[];
}

export interface SupabaseTeam {
  id: string;
  activity_id: string;
  team_name: string;
  team_code: string;
  passcode_plaintext: string;
  submitted_at: string | null;
  locked: boolean;
}

export interface MissionDraft {
  keyword?: string;
  sentence?: string;
  photoName?: string;
  audioName?: string;
  stationSigns?: StationSign[];
  paleontology?: Record<string, string>;
  countryText?: string;
  interviewCompleted?: boolean;
  worldFriends?: WorldFriendEntry[];
}

export interface StationSign {
  english: string;
  chinese: string;
  purpose: string;
  location: string;
}

export interface WorldFriendEntry {
  id: string;
  countryText: string;
  photoName?: string;
}
