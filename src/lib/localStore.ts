import type { MissionDraft, SupabaseTeam, TeamDraft } from "../types/mission";

const TEAM_KEY = "heart-of-taipei-team";
const DRAFT_KEY = "heart-of-taipei-drafts";
const CONNECTED_TEAM_KEY = "heart-of-taipei-connected-team";

export function loadTeam(): TeamDraft | null {
  const raw = window.localStorage.getItem(TEAM_KEY);
  return raw ? (JSON.parse(raw) as TeamDraft) : null;
}

export function saveTeam(team: TeamDraft) {
  window.localStorage.setItem(TEAM_KEY, JSON.stringify(team));
}

export function loadDrafts(): Record<string, MissionDraft> {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  return raw ? (JSON.parse(raw) as Record<string, MissionDraft>) : {};
}

export function saveDrafts(drafts: Record<string, MissionDraft>) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

export function loadConnectedTeam(): SupabaseTeam | null {
  const raw = window.localStorage.getItem(CONNECTED_TEAM_KEY);
  return raw ? (JSON.parse(raw) as SupabaseTeam) : null;
}

export function saveConnectedTeam(team: SupabaseTeam) {
  window.localStorage.setItem(CONNECTED_TEAM_KEY, JSON.stringify(team));
}

export function clearConnectedTeam() {
  window.localStorage.removeItem(CONNECTED_TEAM_KEY);
}
