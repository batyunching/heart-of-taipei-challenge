import { DEFAULT_ACTIVITY_ID } from "./teamApi";
import { supabase } from "./supabase";
import type { Mission, MissionDraft } from "../types/mission";

export type MissionIdMap = Record<string, string>;
export type SubmissionStatus = "draft" | "synced" | "completed";

interface DbMission {
  id: string;
  page_key: string;
  sort_order: number;
}

export async function loadMissionIdMap(localMissions: Mission[]): Promise<MissionIdMap> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { data, error } = await supabase
    .from("missions")
    .select("id,page_key,sort_order")
    .eq("activity_id", DEFAULT_ACTIVITY_ID);

  if (error) {
    throw error;
  }

  const dbMissions = (data ?? []) as DbMission[];
  const localOrder = new Map<string, number>();
  const result: MissionIdMap = {};

  for (const mission of localMissions) {
    const nextOrder = (localOrder.get(mission.pageKey) ?? 0) + 1;
    localOrder.set(mission.pageKey, nextOrder);

    const match = dbMissions.find(
      (dbMission) => dbMission.page_key === mission.pageKey && dbMission.sort_order === nextOrder,
    );

    if (match) {
      result[mission.id] = match.id;
    }
  }

  return result;
}

export async function saveMissionSubmission({
  teamId,
  missionId,
  draft,
  status,
}: {
  teamId: string;
  missionId: string;
  draft: MissionDraft | undefined;
  status: SubmissionStatus;
}) {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { data, error } = await supabase
    .from("submissions")
    .upsert(
      {
        team_id: teamId,
        mission_id: missionId,
        answer_json: normalizeAnswer(draft),
        status,
      },
      { onConflict: "team_id,mission_id" },
    )
    .select("id,status,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function normalizeAnswer(draft: MissionDraft | undefined) {
  return {
    keyword: draft?.keyword ?? "",
    sentence: draft?.sentence ?? "",
    photo_name: draft?.photoName ?? "",
    audio_name: draft?.audioName ?? "",
    paleontology: draft?.paleontology ?? {},
    station_signs: draft?.stationSigns ?? [],
    country_text: draft?.countryText ?? "",
    interview_completed: draft?.interviewCompleted ?? false,
  };
}
