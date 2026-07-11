import { supabase } from "./supabase";

export interface TeamScoreSummary {
  team_id: string;
  total_score: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  updated_at: string;
}

export async function loadTeamScoreSummary(teamId: string): Promise<TeamScoreSummary | null> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { data, error } = await supabase
    .rpc("get_team_score_summary", {
      p_team_id: teamId,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as TeamScoreSummary | null) ?? null;
}
