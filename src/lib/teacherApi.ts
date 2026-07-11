import { DEFAULT_ACTIVITY_ID } from "./teamApi";
import { supabase } from "./supabase";

const MEDIA_BUCKET = "taipei-challenge-media";

export interface TeacherProfile {
  id: string;
  display_name: string;
  role: "teacher" | "admin";
}

export interface TeacherMission {
  id: string;
  page_key: string;
  name_zh: string;
  name_en: string;
  sort_order: number;
}

export interface TeacherTeam {
  id: string;
  team_name: string;
  team_code: string;
  passcode_plaintext: string;
  submitted_at: string | null;
  locked: boolean;
  created_at: string;
}

export interface TeacherSubmission {
  id: string;
  team_id: string;
  mission_id: string;
  answer_json: Record<string, unknown>;
  status: string;
  updated_at: string;
}

export interface TeacherMediaFile {
  id: string;
  team_id: string;
  mission_id: string | null;
  type: "photo" | "audio";
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  upload_status: string;
  review_status: string | null;
  signed_url: string | null;
  created_at: string;
}

export interface TeacherDashboardData {
  teams: TeacherTeam[];
  missions: TeacherMission[];
  submissions: TeacherSubmission[];
  mediaFiles: TeacherMediaFile[];
}

export async function registerTeacher(accessCode: string, displayName: string): Promise<TeacherProfile> {
  await ensureAuthenticatedSession();

  const { data, error } = await supabase!.rpc("register_teacher", {
    p_access_code: accessCode,
    p_display_name: displayName.trim() || "現場教師",
  });

  if (error) {
    throw error;
  }

  return data as TeacherProfile;
}

export async function loadTeacherDashboard(): Promise<TeacherDashboardData> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  const client = supabase;

  const [teams, missions, submissions] = await Promise.all([
    client
      .from("teams")
      .select("id,team_name,team_code,passcode_plaintext,submitted_at,locked,created_at")
      .eq("activity_id", DEFAULT_ACTIVITY_ID)
      .order("created_at", { ascending: true }),
    client
      .from("missions")
      .select("id,page_key,name_zh,name_en,sort_order")
      .eq("activity_id", DEFAULT_ACTIVITY_ID)
      .order("page_key", { ascending: true })
      .order("sort_order", { ascending: true }),
    client
      .from("submissions")
      .select("id,team_id,mission_id,answer_json,status,updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  for (const result of [teams, missions, submissions]) {
    if (result.error) {
      throw result.error;
    }
  }

  const mediaFilesWithReview = await client
    .from("media_files")
    .select("id,team_id,mission_id,type,storage_path,file_size,mime_type,upload_status,review_status,created_at")
    .order("created_at", { ascending: false });
  let mediaFilesData: unknown[] | null = mediaFilesWithReview.data;
  let mediaFilesError = mediaFilesWithReview.error;

  if (mediaFilesError && mediaFilesError.message.includes("review_status")) {
    const fallbackMediaFiles = await client
      .from("media_files")
      .select("id,team_id,mission_id,type,storage_path,file_size,mime_type,upload_status,created_at")
      .order("created_at", { ascending: false });
    mediaFilesData = (fallbackMediaFiles.data ?? []).map((file) => ({
      ...file,
      review_status: "pending",
    }));
    mediaFilesError = fallbackMediaFiles.error;
  }

  if (mediaFilesError) {
    throw mediaFilesError;
  }

  const filesWithUrls = await Promise.all(
    ((mediaFilesData ?? []) as Omit<TeacherMediaFile, "signed_url">[]).map(async (file) => {
      const { data } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(file.storage_path, 60 * 60);
      return {
        ...file,
        review_status: file.review_status ?? "pending",
        signed_url: data?.signedUrl ?? null,
      };
    }),
  );

  return {
    teams: (teams.data ?? []) as TeacherTeam[],
    missions: (missions.data ?? []) as TeacherMission[],
    submissions: (submissions.data ?? []) as TeacherSubmission[],
    mediaFiles: filesWithUrls,
  };
}

export async function approveSubmission(submissionId: string): Promise<void> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { error } = await supabase.rpc("approve_submission", {
    p_submission_id: submissionId,
  });

  if (error) {
    throw error;
  }
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { error } = await supabase.rpc("delete_submission", {
    p_submission_id: submissionId,
  });

  if (error) {
    throw error;
  }
}

export async function approveMediaFile(mediaFileId: string): Promise<void> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { error } = await supabase.rpc("approve_media_file", {
    p_media_file_id: mediaFileId,
  });

  if (error) {
    throw error;
  }
}

export async function deleteMediaFile(mediaFileId: string): Promise<void> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { error } = await supabase.rpc("delete_media_file", {
    p_media_file_id: mediaFileId,
  });

  if (error) {
    throw error;
  }
}

export async function deleteTeamData(teamId: string): Promise<void> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { error } = await supabase.rpc("delete_team_data", {
    p_team_id: teamId,
  });

  if (error) {
    throw error;
  }
}

async function ensureAuthenticatedSession() {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const current = await supabase.auth.getSession();
  if (current.error) {
    throw current.error;
  }

  if (current.data.session) {
    return current.data.session;
  }

  const anonymous = await supabase.auth.signInAnonymously();
  if (anonymous.error) {
    throw anonymous.error;
  }

  if (!anonymous.data.session) {
    throw new Error("AUTH_SESSION_NOT_CREATED");
  }

  return anonymous.data.session;
}
