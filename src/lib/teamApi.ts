import { supabase } from "./supabase";
import type { SupabaseTeam, TeamDraft } from "../types/mission";

export const DEFAULT_ACTIVITY_ID = "00000000-0000-0000-0000-000000000101";

async function ensureAnonymousSession() {
  if (!supabase) {
    throw new Error("尚未設定 Supabase 環境變數。");
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
    throw new Error("無法建立匿名登入 session。");
  }

  return anonymous.data.session;
}

export async function createTeam(team: TeamDraft): Promise<SupabaseTeam> {
  await ensureAnonymousSession();

  const { data, error } = await supabase!.rpc("create_team", {
    p_activity_id: DEFAULT_ACTIVITY_ID,
    p_team_name: team.teamName,
    p_passcode: team.passcode,
    p_members: team.members.map((member, index) => ({
      class_name: member.className,
      seat_number: member.seatNumber,
      student_name: member.studentName,
      sort_order: index + 1,
    })),
  });

  if (error) {
    throw error;
  }

  return data as SupabaseTeam;
}

export async function loginTeam(teamCodeOrName: string, passcode: string): Promise<SupabaseTeam> {
  await ensureAnonymousSession();

  const { data, error } = await supabase!.rpc("login_team", {
    p_team_code: teamCodeOrName,
    p_passcode: passcode,
  });

  if (error) {
    throw error;
  }

  return data as SupabaseTeam;
}
