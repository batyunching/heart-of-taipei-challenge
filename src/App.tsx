import { useEffect, useMemo, useState } from "react";
import { contentPages, interviewPrompts, missions } from "./data/seedContent";
import {
  loadConnectedTeam,
  loadDrafts,
  loadTeam,
  saveConnectedTeam,
  saveDrafts,
  saveTeam,
} from "./lib/localStore";
import { uploadMissionMedia, type MediaType } from "./lib/mediaApi";
import { speakEnglish } from "./lib/speech";
import { isSupabaseConfigured } from "./lib/supabase";
import {
  loadTeamSubmissionStatuses,
  loadMissionIdMap,
  saveMissionSubmission,
  type MissionIdMap,
  type SubmissionStatus,
} from "./lib/submissionApi";
import {
  approveScoreItem,
  approveMediaFile,
  approveSubmission,
  deleteMediaFile,
  deleteSubmission,
  deleteTeamData,
  loadTeacherDashboard,
  rejectScoreItem,
  registerTeacher,
  resetScoreItem,
  type TeacherDashboardData,
} from "./lib/teacherApi";
import { loadTeamScoreSummary, type TeamScoreSummary } from "./lib/scoreApi";
import { createTeam, loginTeam } from "./lib/teamApi";
import type { Mission, MissionDraft, PageKey, SupabaseTeam, TeamDraft, WorldFriendEntry } from "./types/mission";

const pageOrder: PageKey[] = [
  "home",
  "peace_park",
  "ntm_main",
  "paleontology",
  "taipei_station",
  "world_friend",
  "review_submit",
];

const emptyMembers = Array.from({ length: 3 }, () => ({
  className: "",
  seatNumber: "",
  studentName: "",
}));

const defaultTeam: TeamDraft = {
  teamName: "",
  passcode: "",
  memberCount: 3,
  members: emptyMembers,
};

export function App() {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [teacherGate, setTeacherGate] = useState("");
  const [teacherDisplayName, setTeacherDisplayName] = useState("現場教師");
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);
  const [teacherStatus, setTeacherStatus] = useState("請輸入教師後台密碼。");
  const [teacherDashboardData, setTeacherDashboardData] = useState<TeacherDashboardData | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherActionBusy, setTeacherActionBusy] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [team, setTeam] = useState<TeamDraft>(() => loadTeam() ?? defaultTeam);
  const [connectedTeam, setConnectedTeam] = useState<SupabaseTeam | null>(() => loadConnectedTeam());
  const [teamSyncStatus, setTeamSyncStatus] = useState(() =>
    connectedTeam ? `已登入小組：${connectedTeam.team_name}，隊伍代碼 ${connectedTeam.team_code}` : "尚未連線到 Supabase 小組。",
  );
  const [teamActionBusy, setTeamActionBusy] = useState(false);
  const [missionIdMap, setMissionIdMap] = useState<MissionIdMap>({});
  const [missionSyncStatus, setMissionSyncStatus] = useState<Record<string, string>>({});
  const [studentSubmissionStatuses, setStudentSubmissionStatuses] = useState<Record<string, SubmissionStatus>>({});
  const [studentScoreSummary, setStudentScoreSummary] = useState<TeamScoreSummary | null>(null);
  const [studentScoreStatus, setStudentScoreStatus] = useState("");
  const [savingMissionId, setSavingMissionId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Partial<Record<MediaType, File>>>>({});
  const [worldFriendFiles, setWorldFriendFiles] = useState<Record<string, File>>({});
  const [stationSignFiles, setStationSignFiles] = useState<Record<string, File>>({});
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>(() => loadDrafts());
  const [showChinese, setShowChinese] = useState<Record<PageKey, boolean>>({
    home: false,
    peace_park: false,
    ntm_main: false,
    paleontology: false,
    taipei_station: false,
    world_friend: false,
    review_submit: false,
  });
  const [lastSaved, setLastSaved] = useState<string>("尚未儲存");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveTeam(team);
      saveDrafts(drafts);
      setLastSaved(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [team, drafts]);

  useEffect(() => {
    if (!connectedTeam || !isSupabaseConfigured) return;

    let cancelled = false;
    loadMissionIdMap(missions)
      .then((map) => {
        if (!cancelled) {
          setMissionIdMap(map);
          void refreshStudentSubmissionStatuses(map);
          void refreshStudentScoreSummary();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMissionSyncStatus((current) => ({
            ...current,
            system: "無法讀取 Supabase 關卡對應，請稍後再試。",
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectedTeam]);

  useEffect(() => {
    if (!connectedTeam || !isSupabaseConfigured) return;

    const teamId = connectedTeam.id;
    const refresh = () => {
      void refreshStudentScoreSummary(teamId);
    };
    const timer = window.setInterval(refresh, 15000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connectedTeam]);

  async function refreshStudentSubmissionStatuses(map = missionIdMap) {
    if (!connectedTeam || !isSupabaseConfigured) return;

    try {
      const rows = await loadTeamSubmissionStatuses(connectedTeam.id);
      const localMissionByDbId = new Map(Object.entries(map).map(([localId, dbId]) => [dbId, localId]));
      const nextStatuses: Record<string, SubmissionStatus> = {};

      for (const row of rows) {
        const localMissionId = localMissionByDbId.get(row.mission_id);
        if (localMissionId) {
          nextStatuses[localMissionId] = row.status;
        }
      }

      setStudentSubmissionStatuses(nextStatuses);
    } catch {
      setMissionSyncStatus((current) => ({
        ...current,
        system: "暫時無法讀取審核狀態，作答仍可繼續保存。",
      }));
    }
  }

  async function refreshStudentScoreSummary(teamId = connectedTeam?.id) {
    if (!teamId || !isSupabaseConfigured) return;

    try {
      const summary = await loadTeamScoreSummary(teamId);
      setStudentScoreSummary(summary);
      const updatedAt = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      setStudentScoreStatus(summary ? `分數已更新 ${updatedAt}` : "尚未產生得分項目");
    } catch {
      setStudentScoreStatus("暫時無法讀取小組分數");
    }
  }

  const page = contentPages.find((item) => item.key === activePage)!;
  const pageMissions = missions.filter((mission) => mission.pageKey === activePage);
  const completedCount = useMemo(() => {
    return missions.filter((mission) => isMissionComplete(mission, drafts[mission.id])).length;
  }, [drafts]);

  function updateDraft(id: string, patch: MissionDraft) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  function selectMissionFile(id: string, type: MediaType, file: File | undefined) {
    setSelectedFiles((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [type]: file,
      },
    }));

    updateDraft(id, type === "photo" ? { photoName: file?.name } : { audioName: file?.name });
  }

  function selectWorldFriendPhoto(entryId: string, file: File | undefined) {
    setWorldFriendFiles((current) => {
      const next = { ...current };
      if (file) {
        next[entryId] = file;
      } else {
        delete next[entryId];
      }
      return next;
    });

    const entries = normalizeWorldFriendEntries(drafts["world-friend"]).map((entry) =>
      entry.id === entryId ? { ...entry, photoName: file?.name } : entry,
    );
    updateDraft("world-friend", {
      worldFriends: entries,
      countryText: entries[0]?.countryText ?? "",
      photoName: entries.map((entry) => entry.photoName).filter(Boolean).join("、"),
    });
  }

  function selectStationSignPhoto(missionId: string, index: number, file: File | undefined) {
    const key = `${missionId}:${index}`;
    setStationSignFiles((current) => {
      const next = { ...current };
      if (file) {
        next[key] = file;
      } else {
        delete next[key];
      }
      return next;
    });

    const signs = normalizeStationSigns(drafts[missionId]).map((sign, signIndex) =>
      signIndex === index ? { ...sign, photoName: file?.name } : sign,
    );
    updateDraft(missionId, {
      stationSigns: signs,
      photoName: signs.map((sign) => sign.photoName).filter(Boolean).join("、"),
    });
  }

  function updateMember(index: number, key: keyof TeamDraft["members"][number], value: string) {
    setTeam((current) => {
      const members = [...current.members];
      members[index] = { ...members[index], [key]: value };
      return { ...current, members };
    });
  }

  function updateMemberCount(count: number) {
    setTeam((current) => {
      const members = [...current.members];
      while (members.length < count) {
        members.push({ className: "", seatNumber: "", studentName: "" });
      }
      return {
        ...current,
        memberCount: count,
        members: members.slice(0, count),
      };
    });
  }

  async function handleCreateTeam() {
    setTeamActionBusy(true);
    setTeamSyncStatus("正在建立小組...");
    try {
      const created = await createTeam(team);
      setConnectedTeam(created);
      saveConnectedTeam(created);
      setTeam((current) => ({ ...current, teamName: created.team_name, passcode: created.passcode_plaintext }));
      setTeamSyncStatus(`已建立小組：${created.team_name}，隊伍代碼 ${created.team_code}`);
      void refreshStudentScoreSummary(created.id);
    } catch (error) {
      setTeamSyncStatus(toFriendlyTeamError(error));
    } finally {
      setTeamActionBusy(false);
    }
  }

  async function handleLoginTeam() {
    setTeamActionBusy(true);
    setTeamSyncStatus("正在登入小組...");
    try {
      const loggedIn = await loginTeam(team.teamName, team.passcode);
      setConnectedTeam(loggedIn);
      saveConnectedTeam(loggedIn);
      setTeam((current) => ({
        ...current,
        teamName: loggedIn.team_name,
        passcode: loggedIn.passcode_plaintext,
      }));
      setTeamSyncStatus(`已登入小組：${loggedIn.team_name}，隊伍代碼 ${loggedIn.team_code}`);
      void refreshStudentScoreSummary(loggedIn.id);
    } catch (error) {
      setTeamSyncStatus(toFriendlyTeamError(error));
    } finally {
      setTeamActionBusy(false);
    }
  }

  async function handleTeacherUnlock() {
    if (teacherGate !== "tkjhs810") {
      setTeacherStatus("教師後台密碼不正確。");
      return;
    }

    setTeacherLoading(true);
    setTeacherStatus("正在確認教師權限...");
    try {
      await registerTeacher(teacherGate, teacherDisplayName);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherUnlocked(true);
      setTeacherStatus("已載入 Supabase 教師後台資料。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherLoading(false);
    }
  }

  async function refreshTeacherDashboard() {
    setTeacherLoading(true);
    setTeacherStatus("正在重新整理教師後台資料...");
    try {
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已更新 Supabase 教師後台資料。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherLoading(false);
    }
  }

  async function handleApproveSubmission(submissionId: string) {
    setTeacherActionBusy(`approve-${submissionId}`);
    setTeacherStatus("正在標記審核通過...");
    try {
      await approveSubmission(submissionId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已標記審核通過。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleDeleteSubmission(submissionId: string, missionName: string) {
    const confirmed = window.confirm(`確定要刪除「${missionName}」這一筆作答嗎？這個動作無法復原。`);
    if (!confirmed) return;

    setTeacherActionBusy(`delete-submission-${submissionId}`);
    setTeacherStatus("正在刪除單筆作答...");
    try {
      await deleteSubmission(submissionId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已刪除單筆作答。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleApproveMediaFile(mediaFileId: string) {
    setTeacherActionBusy(`approve-media-${mediaFileId}`);
    setTeacherStatus("正在標記照片審核通過...");
    try {
      await approveMediaFile(mediaFileId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已標記照片審核通過。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleApproveScoreItem(scoreItemId: string) {
    setTeacherActionBusy(`approve-score-${scoreItemId}`);
    setTeacherStatus("正在審核通過得分項目...");
    try {
      await approveScoreItem(scoreItemId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已審核通過得分項目。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleApproveTeamScoreItems(teamId: string, teamName: string, scoreItemIds: string[]) {
    if (!scoreItemIds.length) {
      setTeacherStatus(`「${teamName}」目前沒有需要批次審核通過的得分項目。`);
      return;
    }

    const confirmed = window.confirm(
      `確定要將「${teamName}」目前畫面中的 ${scoreItemIds.length} 個待審核或退回得分項目全部審核通過嗎？`,
    );
    if (!confirmed) return;

    setTeacherActionBusy(`approve-team-${teamId}`);
    setTeacherStatus(`正在批次審核通過「${teamName}」的得分項目...`);
    try {
      await Promise.all(scoreItemIds.map((scoreItemId) => approveScoreItem(scoreItemId)));
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus(`已批次審核通過「${teamName}」的 ${scoreItemIds.length} 個得分項目。`);
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleRejectScoreItem(scoreItemId: string, label: string) {
    const note = window.prompt(`請輸入「${label}」退回原因，可留空。`);
    if (note === null) return;

    setTeacherActionBusy(`reject-score-${scoreItemId}`);
    setTeacherStatus("正在退回得分項目...");
    try {
      await rejectScoreItem(scoreItemId, note);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已退回得分項目。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleResetScoreItem(scoreItemId: string, label: string) {
    const confirmed = window.confirm(`確定要把「${label}」重設為待審核嗎？`);
    if (!confirmed) return;

    setTeacherActionBusy(`reset-score-${scoreItemId}`);
    setTeacherStatus("正在重設得分項目...");
    try {
      await resetScoreItem(scoreItemId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已重設為待審核。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleDeleteMediaFile(mediaFileId: string, mediaLabel: string) {
    const confirmed = window.confirm(`確定要刪除這個「${mediaLabel}」檔案嗎？這個動作無法復原。`);
    if (!confirmed) return;

    setTeacherActionBusy(`delete-media-${mediaFileId}`);
    setTeacherStatus("正在刪除上傳檔案...");
    try {
      await deleteMediaFile(mediaFileId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus("已刪除上傳檔案。");
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function handleDeleteTeamData(teamId: string, teamName: string) {
    const confirmed = window.confirm(`確定要刪除「${teamName}」的隊伍、作答與上傳檔案嗎？這個動作無法復原。`);
    if (!confirmed) return;

    setTeacherActionBusy(`delete-${teamId}`);
    setTeacherStatus(`正在刪除「${teamName}」資料...`);
    try {
      await deleteTeamData(teamId);
      const data = await loadTeacherDashboard();
      setTeacherDashboardData(data);
      setTeacherStatus(`已刪除「${teamName}」的學生資料。`);
    } catch (error) {
      setTeacherStatus(toFriendlyTeacherError(error));
    } finally {
      setTeacherActionBusy(null);
    }
  }

  async function uploadSelectedMediaForMission(missionId: string, dbMissionId: string, teamId: string) {
    if (missionId === "station-signs") {
      const entries = normalizeStationSigns(drafts[missionId]);

      for (const [index, entry] of entries.entries()) {
        const file = stationSignFiles[`${missionId}:${index}`];
        if (!file) continue;

        setMissionSyncStatus((current) => ({
          ...current,
          [missionId]: `正在上傳第 ${index + 1} 張雙語指標照片...`,
        }));
        await uploadMissionMedia({
          teamId,
          missionId: dbMissionId,
          file,
          type: "photo",
        });
      }

      return;
    }

    if (missionId === "world-friend") {
      const entries = normalizeWorldFriendEntries(drafts["world-friend"]);

      for (const entry of entries) {
        const file = worldFriendFiles[entry.id];
        if (!file) continue;

        setMissionSyncStatus((current) => ({
          ...current,
          [missionId]: `正在上傳第 ${entries.indexOf(entry) + 1} 組合照...`,
        }));
        await uploadMissionMedia({
          teamId,
          missionId: dbMissionId,
          file,
          type: "photo",
        });
      }

      return;
    }

    const files = selectedFiles[missionId] ?? {};

    if (files.photo) {
      setMissionSyncStatus((current) => ({
        ...current,
        [missionId]: "正在上傳照片...",
      }));
      await uploadMissionMedia({
        teamId,
        missionId: dbMissionId,
        file: files.photo,
        type: "photo",
      });
    }

    if (files.audio) {
      setMissionSyncStatus((current) => ({
        ...current,
        [missionId]: "正在上傳錄音...",
      }));
      await uploadMissionMedia({
        teamId,
        missionId: dbMissionId,
        file: files.audio,
        type: "audio",
      });
    }
  }

  async function handleSaveMission(mission: Mission) {
    if (!connectedTeam) {
      setMissionSyncStatus((current) => ({
        ...current,
        [mission.id]: "請先登入小組，再儲存作答。",
      }));
      return;
    }

    const dbMissionId = missionIdMap[mission.id];
    if (!dbMissionId) {
      setMissionSyncStatus((current) => ({
        ...current,
        [mission.id]: "尚未取得資料庫關卡對應，請稍後再試一次。",
      }));
      return;
    }

    setSavingMissionId(mission.id);
    setMissionSyncStatus((current) => ({
      ...current,
      [mission.id]: "正在儲存到 Supabase...",
    }));

    try {
      const draft = drafts[mission.id];
      await uploadSelectedMediaForMission(mission.id, dbMissionId, connectedTeam.id);
      const savedSubmission = await saveMissionSubmission({
        teamId: connectedTeam.id,
        missionId: dbMissionId,
        draft,
        status: isMissionComplete(mission, draft) ? "completed" : "synced",
      });
      setStudentSubmissionStatuses((current) => ({
        ...current,
        [mission.id]: savedSubmission.status,
      }));
      void refreshStudentScoreSummary(connectedTeam.id);
      setSelectedFiles((current) => ({
        ...current,
        [mission.id]: {},
      }));
      if (mission.id === "world-friend") {
        setWorldFriendFiles({});
      }
      if (mission.id === "station-signs") {
        setStationSignFiles((current) =>
          Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${mission.id}:`))),
        );
      }
      setMissionSyncStatus((current) => ({
        ...current,
        [mission.id]: "已儲存到 Supabase submissions。",
      }));
    } catch (error) {
      setMissionSyncStatus((current) => ({
        ...current,
        [mission.id]: toFriendlySubmissionError(error),
      }));
    } finally {
      setSavingMissionId(null);
    }
  }

  if (mode === "teacher") {
    return (
      <main className="app-shell">
        <TopBar mode={mode} setMode={setMode} />
        {!teacherUnlocked ? (
          <section className="hero-panel">
            <p className="eyebrow">Teacher Dashboard</p>
            <h1>教師後台</h1>
            <p>請輸入共用入口密碼。後續正式版仍會搭配 Supabase Auth 與 RLS 控制資料權限。</p>
            <div className="field-row">
              <label>
                教師姓名
                <input
                  value={teacherDisplayName}
                  onChange={(event) => setTeacherDisplayName(event.target.value)}
                  placeholder="例如：黃主任"
                />
              </label>
              <label>
                後台入口密碼
                <input
                  type="password"
                  value={teacherGate}
                  onChange={(event) => setTeacherGate(event.target.value)}
                  placeholder="請輸入密碼"
                />
              </label>
              <button
                className="primary-button"
                disabled={teacherLoading}
                onClick={handleTeacherUnlock}
              >
                進入後台
              </button>
            </div>
            {teacherGate && teacherGate !== "tkjhs810" ? (
              <p className="warning-text">密碼尚未正確。</p>
            ) : null}
            <p className={teacherStatus.includes("已") ? "success-text" : "warning-text"}>{teacherStatus}</p>
          </section>
        ) : (
          <TeacherSupabaseDashboard
            data={teacherDashboardData}
            status={teacherStatus}
            loading={teacherLoading}
            onRefresh={refreshTeacherDashboard}
            actionBusy={teacherActionBusy}
            onApproveSubmission={handleApproveSubmission}
            onDeleteSubmission={handleDeleteSubmission}
            onApproveMediaFile={handleApproveMediaFile}
            onApproveScoreItem={handleApproveScoreItem}
            onApproveTeamScoreItems={handleApproveTeamScoreItems}
            onRejectScoreItem={handleRejectScoreItem}
            onResetScoreItem={handleResetScoreItem}
            onDeleteMediaFile={handleDeleteMediaFile}
            onDeleteTeamData={handleDeleteTeamData}
          />
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <TopBar mode={mode} setMode={setMode} />
      <section className="hero-panel">
        <p className="eyebrow">Heart of Taipei</p>
        <h1>台北之心・雙語闖關</h1>
        <p>學生小組活動網站骨架。現在以本機草稿保存為主，待 Supabase 確認後接上正式資料庫與媒體上傳。</p>
        <div className="status-grid">
          <span>Supabase：{isSupabaseConfigured ? "已設定" : "尚未設定環境變數"}</span>
          <span>小組：{connectedTeam ? `${connectedTeam.team_name} / ${connectedTeam.team_code}` : "尚未登入"}</span>
          <span>完成進度：{completedCount} / {missions.length}</span>
          <span>最後儲存：{lastSaved}</span>
        </div>
      </section>

      <section className="team-panel">
        <div>
          <p className="eyebrow">Team Login / Create Team</p>
          <h2>小組登入／建立隊伍</h2>
        </div>
        <div className="team-grid">
          <label>
            隊名或隊伍代碼
            <input
              value={team.teamName}
              onChange={(event) => setTeam({ ...team, teamName: event.target.value })}
              placeholder="例如：第一組或 HEART01"
            />
          </label>
          <label>
            通關碼
            <input
              value={team.passcode}
              onChange={(event) => setTeam({ ...team, passcode: event.target.value })}
              placeholder="由小組自行設定"
            />
          </label>
          <label>
            組員人數
            <select
              value={team.memberCount}
              onChange={(event) => updateMemberCount(Number(event.target.value))}
            >
              {[3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>{count} 人</option>
              ))}
            </select>
          </label>
        </div>
        <div className="member-grid">
          {team.members.map((member, index) => (
            <div className="member-card" key={index}>
              <strong>組員 {index + 1}</strong>
              <input
                value={member.className}
                onChange={(event) => updateMember(index, "className", event.target.value)}
                placeholder="班級"
              />
              <input
                value={member.seatNumber}
                onChange={(event) => updateMember(index, "seatNumber", event.target.value)}
                placeholder="座號"
              />
              <input
                value={member.studentName}
                onChange={(event) => updateMember(index, "studentName", event.target.value)}
                placeholder="姓名"
              />
            </div>
          ))}
        </div>
        <div className="team-actions">
          <button
            className="primary-button"
            disabled={teamActionBusy || !isSupabaseConfigured}
            onClick={handleCreateTeam}
          >
            建立隊伍 Create Team
          </button>
          <button
            className="secondary-button"
            disabled={teamActionBusy || !isSupabaseConfigured}
            onClick={handleLoginTeam}
          >
            登入既有隊伍 Login
          </button>
        </div>
        <p className={teamSyncStatus.includes("已") ? "success-text" : "warning-text"}>
          {isSupabaseConfigured ? teamSyncStatus : "尚未設定 Supabase 環境變數，因此目前只能使用本機草稿。"}
        </p>
      </section>

      {connectedTeam ? (
        <section className="score-strip" aria-label="小組目前總分">
          <div>
            <span>小組目前總分</span>
            <strong>{studentScoreSummary?.total_score ?? 0} 分</strong>
          </div>
          <div>
            <span>已通過</span>
            <strong>{studentScoreSummary?.approved_count ?? 0} 項</strong>
          </div>
          <div>
            <span>待審核</span>
            <strong>{studentScoreSummary?.pending_count ?? 0} 項</strong>
          </div>
          <div>
            <span>退回</span>
            <strong>{studentScoreSummary?.rejected_count ?? 0} 項</strong>
          </div>
          <button className="secondary-button" type="button" onClick={() => refreshStudentScoreSummary(connectedTeam.id)}>
            更新分數
          </button>
          {studentScoreStatus ? <p>{studentScoreStatus}</p> : null}
        </section>
      ) : null}

      <nav className="page-tabs" aria-label="關卡頁面">
        {pageOrder.map((key) => {
          const navPage = contentPages.find((item) => item.key === key)!;
          return (
            <button
              key={key}
              className={activePage === key ? "tab-active" : ""}
              onClick={() => setActivePage(key)}
            >
              <span>{navPage.titleZh}</span>
              <small>{navPage.titleEn}</small>
            </button>
          );
        })}
      </nav>

      <section className="page-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{page.titleEn}</p>
            <h2>{page.titleZh}</h2>
          </div>
          <button
            className="secondary-button"
            onClick={() => setShowChinese((current) => ({ ...current, [activePage]: !current[activePage] }))}
          >
            {showChinese[activePage] ? "隱藏中文 Hide Chinese" : "顯示中文 Show Chinese"}
          </button>
        </div>
        <p className="intro-text">{page.introEn}</p>
        {showChinese[activePage] ? <p className="intro-zh">{page.introZh}</p> : null}

        {activePage === "home" ? <HomeCards /> : null}
        {activePage === "world_friend" ? (
          <WorldFriendSection
            draft={drafts["world-friend"]}
            updateDraft={updateDraft}
            onFileSelected={selectWorldFriendPhoto}
            onSave={() => handleSaveMission(missions.find((mission) => mission.id === "world-friend")!)}
            saveStatus={missionSyncStatus["world-friend"] ?? missionSyncStatus.system}
            submissionStatus={studentSubmissionStatuses["world-friend"]}
            saveDisabled={!connectedTeam || savingMissionId === "world-friend"}
          />
        ) : null}
        {activePage === "review_submit" ? (
          <ReviewSection drafts={drafts} submissionStatuses={studentSubmissionStatuses} />
        ) : null}
        {pageMissions
          .filter((mission) => mission.type !== "world_friend")
          .map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              draft={drafts[mission.id]}
              updateDraft={updateDraft}
              onFileSelected={selectMissionFile}
              onStationPhotoSelected={selectStationSignPhoto}
              onSave={() => handleSaveMission(mission)}
              saveStatus={missionSyncStatus[mission.id] ?? missionSyncStatus.system}
              submissionStatus={studentSubmissionStatuses[mission.id]}
              saveDisabled={!connectedTeam || savingMissionId === mission.id}
            />
          ))}
      </section>
    </main>
  );
}

function TopBar({
  mode,
  setMode,
}: {
  mode: "student" | "teacher";
  setMode: (mode: "student" | "teacher") => void;
}) {
  return (
    <header className="top-bar">
      <div>
        <strong>台北之心</strong>
        <span>Heart of Taipei</span>
      </div>
      <div className="mode-switch">
        <button className={mode === "student" ? "tab-active" : ""} onClick={() => setMode("student")}>
          學生端
        </button>
        <button className={mode === "teacher" ? "tab-active" : ""} onClick={() => setMode("teacher")}>
          教師後台
        </button>
      </div>
    </header>
  );
}

function HomeCards() {
  return (
    <div className="venue-grid">
      {[
        ["2/28 Peace Park", "二二八和平公園"],
        ["National Taiwan Museum", "國立臺灣博物館"],
        ["Taipei Main Station", "臺北車站"],
      ].map(([en, zh]) => (
        <article className="venue-card" key={en}>
          <span>{en}</span>
          <strong>{zh}</strong>
        </article>
      ))}
    </div>
  );
}

const keywordTranslations: Record<string, string> = {
  history: "歷史",
  memory: "記憶",
  park: "公園",
  monument: "紀念碑",
  public: "公共的",
  city: "城市",
  peace: "和平",
  observe: "觀察",
  reflection: "反思",
  museum: "博物館",
  object: "物件／文物",
  exhibition: "展覽",
  display: "展示",
  collection: "典藏",
  culture: "文化",
  visitor: "訪客",
  learn: "學習",
  Regulatory: "規範類",
  Informational: "資訊類",
  Safety: "安全類",
  Exhibition: "展覽類",
  fossil: "化石",
  prehistoric: "史前的",
  animal: "動物",
  "Location information": "位置說明",
  "Direction guidance": "方向引導",
  "Machine operation": "機器操作",
  "Arrival / departure information": "到站／離站資訊",
  "Service / safety": "服務／安全",
  interview: "訪談",
  country: "國家",
  photo: "照片",
};

function getKeywordZh(keyword: string) {
  return keywordTranslations[keyword] ?? "中文輔助";
}

function getMissionStatusLabel(mission: Mission, draft: MissionDraft | undefined, submissionStatus?: SubmissionStatus) {
  if (submissionStatus === "approved") return "已審核通過";
  if (mission.type === "station_sign") {
    const photoCount = countStationSignPhotos(draft);
    if (photoCount > 0) return `已選 ${photoCount} 張`;
  }
  return isMissionComplete(mission, draft) ? "已完成" : "草稿";
}

function MissionCard({
  mission,
  draft,
  updateDraft,
  onFileSelected,
  onStationPhotoSelected,
  onSave,
  saveStatus,
  submissionStatus,
  saveDisabled,
}: {
  mission: Mission;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
  onStationPhotoSelected: (missionId: string, index: number, file: File | undefined) => void;
  onSave: () => void;
  saveStatus?: string;
  submissionStatus?: SubmissionStatus;
  saveDisabled: boolean;
}) {
  const [showMissionChinese, setShowMissionChinese] = useState(false);
  const statusLabel = getMissionStatusLabel(mission, draft, submissionStatus);

  return (
    <article className="mission-card">
      <div className="mission-title">
        <div>
          <h3>{mission.titleZh}</h3>
          <p>{mission.titleEn}</p>
        </div>
        <span>{statusLabel}</span>
      </div>
      <p>{mission.introEn}</p>
      <button
        className="inline-help-button"
        type="button"
        onClick={() => setShowMissionChinese((current) => !current)}
      >
        {showMissionChinese ? "隱藏中文輔助" : "顯示中文輔助"}
      </button>
      {showMissionChinese ? <p className="intro-zh mission-zh-help">{mission.introZh}</p> : null}
      <div className="keyword-row">
        {mission.keywords.map((keyword) => (
          <span key={keyword}>
            {keyword}
            {showMissionChinese ? <small>{getKeywordZh(keyword)}</small> : null}
          </span>
        ))}
      </div>

      {mission.type === "info_card" ? (
        <MuseumEnglishCards
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          showChinese={showMissionChinese}
        />
      ) : null}
      {mission.type === "audio" ? (
        <PaleontologyFields
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          onFileSelected={onFileSelected}
          showChinese={showMissionChinese}
        />
      ) : null}
      {mission.type === "station_sign" ? (
        <StationSigns
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          onPhotoSelected={onStationPhotoSelected}
          showChinese={showMissionChinese}
        />
      ) : null}
      {mission.type === "photo_text" ? (
        <PhotoTextFields
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          onFileSelected={onFileSelected}
        />
      ) : null}
      <SubmissionActions onSave={onSave} saveStatus={saveStatus} saveDisabled={saveDisabled} />
    </article>
  );
}

function SubmissionActions({
  onSave,
  saveStatus,
  saveDisabled,
}: {
  onSave: () => void;
  saveStatus?: string;
  saveDisabled: boolean;
}) {
  return (
    <div className="mission-actions">
      <button className="secondary-button" disabled={saveDisabled} onClick={onSave}>
        儲存作答 Save Answer
      </button>
      {saveStatus ? <span>{saveStatus}</span> : null}
    </div>
  );
}

function PhotoTextFields({
  missionId,
  draft,
  updateDraft,
  onFileSelected,
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
}) {
  return (
    <div className="form-grid">
      <label>
        照片
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFileSelected(missionId, "photo", event.target.files?.[0])}
        />
      </label>
      <label>
        核心英文單字
        <input
          value={draft?.keyword ?? ""}
          onChange={(event) => updateDraft(missionId, { keyword: event.target.value })}
          placeholder="例如：history"
        />
      </label>
      <label>
        英文心得一句
        <textarea
          value={draft?.sentence ?? ""}
          onChange={(event) => updateDraft(missionId, { sentence: event.target.value })}
          placeholder="We noticed..."
        />
      </label>
    </div>
  );
}

function PaleontologyFields({
  missionId,
  draft,
  updateDraft,
  onFileSelected,
  showChinese,
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
  showChinese: boolean;
}) {
  const value = draft?.paleontology ?? {};
  const fields = [
    ["name", "name", "名稱"],
    ["type", "fossil or prehistoric animal", "化石或史前動物種類"],
    ["lived", "when it lived", "牠生活的年代"],
    ["ate", "what it ate", "牠吃什麼"],
    ["fact", "interesting fact", "有趣的特色或知識"],
  ];

  return (
    <div className="form-grid">
      {fields.map(([key, label, labelZh]) => (
        <label key={key}>
          {label}
          {showChinese ? <small>{labelZh}</small> : null}
          <input
            value={value[key] ?? ""}
            onChange={(event) =>
              updateDraft(missionId, { paleontology: { ...value, [key]: event.target.value } })
            }
          />
        </label>
      ))}
      <div className="sentence-box">
        <strong>錄音句型</strong>
        <p>This is a ____.</p>
        {showChinese ? <small>這是 ____。</small> : null}
        <p>It lived ____.</p>
        {showChinese ? <small>牠生活在 ____。</small> : null}
        <p>It ate ____.</p>
        {showChinese ? <small>牠吃 ____。</small> : null}
        <p>One interesting fact is ____.</p>
        {showChinese ? <small>一個有趣的特色是 ____。</small> : null}
      </div>
      <label>
        錄音檔
        {showChinese ? <small>請上傳英文介紹錄音。</small> : null}
        <input
          type="file"
          accept="audio/webm,audio/mp4,audio/mpeg,audio/x-m4a"
          onChange={(event) => onFileSelected(missionId, "audio", event.target.files?.[0])}
        />
      </label>
    </div>
  );
}

function StationSigns({
  missionId,
  draft,
  updateDraft,
  onPhotoSelected,
  showChinese,
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onPhotoSelected: (missionId: string, index: number, file: File | undefined) => void;
  showChinese: boolean;
}) {
  const signs = normalizeStationSigns(draft);

  return (
    <div className="sign-list">
      <div className="mission-direction-box">
        <strong>Photo mission</strong>
        <p>
          Try to take up to five photos of bilingual signs with different functions. If you cannot find
          all five, upload the signs you find first.
        </p>
        {showChinese ? (
          <p>目標是五種不同功能的雙語指標；如果現場找不到五張，也可以先上傳已找到的照片。</p>
        ) : null}
      </div>
      {signs.map((sign, index) => (
        <div className="station-sign-card" key={index}>
          <div className="station-sign-heading">
            <strong>
              {index + 1}. {sign.purpose}
            </strong>
            {showChinese ? <span className="purpose-zh">{getKeywordZh(sign.purpose)}</span> : null}
          </div>
          <div className="sign-row">
            <input
              value={sign.english}
              onChange={(event) => {
                const next = [...signs];
                next[index] = { ...sign, english: event.target.value };
                updateDraft(missionId, { stationSigns: next });
              }}
              placeholder="English on the sign"
            />
            <input
              value={sign.chinese}
              onChange={(event) => {
                const next = [...signs];
                next[index] = { ...sign, chinese: event.target.value };
                updateDraft(missionId, { stationSigns: next });
              }}
              placeholder="中文標示"
            />
            <label>
              雙語指標照片
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => onPhotoSelected(missionId, index, event.target.files?.[0])}
              />
            </label>
          </div>
          <p className="muted station-photo-note">
            {sign.photoName
              ? `已選擇：${sign.photoName}`
              : `可上傳「${getKeywordZh(sign.purpose)}」功能的雙語指標照片；找不到時可留空。`}
          </p>
        </div>
      ))}
    </div>
  );
}

function MuseumEnglishCards({
  missionId,
  draft,
  updateDraft,
  showChinese,
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  showChinese: boolean;
}) {
  const cards = [
    ["regulatory", "Regulatory", "規範類", "Rules or instructions visitors should follow.", "No flash photography.", "參觀者需要遵守的規則或指示。"],
    ["informational", "Informational", "資訊類", "Helpful facts and visitor information.", "Information desk.", "提供參觀資訊、服務或事實說明。"],
    ["safety", "Safety", "安全類", "Signs that protect visitors.", "Emergency exit.", "提醒安全、逃生或保護參觀者的標示。"],
    ["exhibition", "Exhibition", "展覽類", "Words used in displays.", "Permanent exhibition.", "展場、展品說明或展示分類常見用語。"],
  ];

  const categories = normalizeMuseumCategories(draft);

  function updateCategory(categoryId: string, rowIndex: number, field: "word" | "chinese", value: string) {
    const next = normalizeMuseumCategories(draft);
    next[categoryId] = next[categoryId].map((entry, index) =>
      index === rowIndex ? { ...entry, [field]: value } : entry,
    );
    updateDraft(missionId, { museumCategories: next });
  }

  return (
    <div className="info-card-grid">
      {cards.map(([categoryId, title, titleZh, use, example, useZh]) => (
        <article className="info-card museum-category-card" key={categoryId}>
          <strong>{title}</strong>
          {showChinese ? <small>{titleZh}</small> : null}
          <p>{use}</p>
          {showChinese ? <p className="muted">{useZh}</p> : null}
          <span>{example}</span>
          <div className="museum-entry-list">
            {categories[categoryId].map((entry, index) => (
              <div className="museum-entry-row" key={`${categoryId}-${index}`}>
                <span>{index + 1}</span>
                <input
                  value={entry.word}
                  onChange={(event) => updateCategory(categoryId, index, "word", event.target.value)}
                  placeholder="English word"
                />
                <input
                  value={entry.chinese}
                  onChange={(event) => updateCategory(categoryId, index, "chinese", event.target.value)}
                  placeholder="中文意思"
                />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function WorldFriendSection({
  draft,
  updateDraft,
  onFileSelected,
  onSave,
  saveStatus,
  submissionStatus,
  saveDisabled,
}: {
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (entryId: string, file: File | undefined) => void;
  onSave: () => void;
  saveStatus?: string;
  submissionStatus?: SubmissionStatus;
  saveDisabled: boolean;
}) {
  const [speechWarning, setSpeechWarning] = useState("");
  const entries = normalizeWorldFriendEntries(draft);

  function updateEntries(nextEntries: WorldFriendEntry[]) {
    updateDraft("world-friend", {
      worldFriends: nextEntries,
      countryText: nextEntries[0]?.countryText ?? "",
      photoName: nextEntries.map((entry) => entry.photoName).filter(Boolean).join("、"),
    });
  }

  return (
    <article className="mission-card highlight-card">
      <div className="mission-title">
        <div>
          <h3>訪談句型</h3>
          <p>Interview Prompts</p>
        </div>
        <span>
          {submissionStatus === "approved" ? "已審核通過" : hasCompletedWorldFriendEntry(draft) ? "已有紀錄" : "草稿"}
        </span>
      </div>
      <div className="prompt-list">
        {interviewPrompts.map((prompt) => (
          <div className="prompt-card" key={prompt.id}>
            <div>
              <strong>{prompt.label}</strong>
              <p>{prompt.zh}</p>
              <p className="prompt-en">{prompt.en}</p>
            </div>
            <button
              className="listen-button"
              onClick={() => {
                const ok = speakEnglish(prompt.en);
                setSpeechWarning(ok ? "" : "此裝置不支援語音播放，請直接閱讀英文句子。");
              }}
            >
              播放發音 Listen
            </button>
          </div>
        ))}
      </div>
      {speechWarning ? <p className="warning-text">{speechWarning}</p> : null}
      <div className="world-friend-list">
        {entries.map((entry, index) => (
          <div className="world-friend-entry" key={entry.id}>
            <div className="world-friend-entry-title">
              <strong>外國朋友第 {index + 1} 組</strong>
              {entries.length > 1 ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => updateEntries(entries.filter((item) => item.id !== entry.id))}
                >
                  移除
                </button>
              ) : null}
            </div>
            <div className="form-grid">
              <label>
                外國朋友的國家
                <input
                  value={entry.countryText}
                  onChange={(event) => {
                    const next = entries.map((item) =>
                      item.id === entry.id ? { ...item, countryText: event.target.value } : item,
                    );
                    updateEntries(next);
                  }}
                  placeholder="自由輸入，例如：Japan、USA、France"
                />
              </label>
              <label>
                合照照片
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => onFileSelected(entry.id, event.target.files?.[0])}
                />
              </label>
              <p className="muted world-friend-photo-note">
                {entry.photoName ? `已選擇：${entry.photoName}` : "遇到一組外國朋友，就在這裡新增並上傳一張合照。"}
              </p>
            </div>
          </div>
        ))}
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            updateEntries([
              ...entries,
              {
                id: createWorldFriendEntryId(),
                countryText: "",
              },
            ])
          }
        >
          新增一組外國朋友
        </button>
      </div>
      <SubmissionActions onSave={onSave} saveStatus={saveStatus} saveDisabled={saveDisabled} />
    </article>
  );
}

function ReviewSection({
  drafts,
  submissionStatuses,
}: {
  drafts: Record<string, MissionDraft>;
  submissionStatuses: Record<string, SubmissionStatus>;
}) {
  return (
    <div className="review-list">
      {missions.map((mission) => (
        <div className="review-row" key={mission.id}>
          <div>
            <strong>{mission.titleZh}</strong>
            <span>{mission.titleEn}</span>
          </div>
          <mark>
            {submissionStatuses[mission.id] === "approved"
              ? "老師已審核通過"
              : isMissionComplete(mission, drafts[mission.id])
                ? "已完成"
                : "尚有缺漏"}
          </mark>
        </div>
      ))}
      <button className="primary-button">送出成果 Submit</button>
    </div>
  );
}

function TeacherSupabaseDashboard({
  data,
  status,
  loading,
  onRefresh,
  actionBusy,
  onApproveSubmission,
  onDeleteSubmission,
  onApproveMediaFile,
  onApproveScoreItem,
  onApproveTeamScoreItems,
  onRejectScoreItem,
  onResetScoreItem,
  onDeleteMediaFile,
  onDeleteTeamData,
}: {
  data: TeacherDashboardData | null;
  status: string;
  loading: boolean;
  onRefresh: () => void;
  actionBusy: string | null;
  onApproveSubmission: (submissionId: string) => void;
  onDeleteSubmission: (submissionId: string, missionName: string) => void;
  onApproveMediaFile: (mediaFileId: string) => void;
  onApproveScoreItem: (scoreItemId: string) => void;
  onApproveTeamScoreItems: (teamId: string, teamName: string, scoreItemIds: string[]) => void;
  onRejectScoreItem: (scoreItemId: string, label: string) => void;
  onResetScoreItem: (scoreItemId: string, label: string) => void;
  onDeleteMediaFile: (mediaFileId: string, mediaLabel: string) => void;
  onDeleteTeamData: (teamId: string, teamName: string) => void;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState("all");
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Record<string, boolean>>({});

  if (!data) {
    return (
      <section className="page-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Teacher Dashboard</p>
            <h1>教師後台</h1>
          </div>
          <button className="secondary-button" disabled={loading} onClick={onRefresh}>
            重新整理
          </button>
        </div>
        <p className="warning-text">{status}</p>
      </section>
    );
  }

  const filteredSubmissions =
    selectedMissionId === "all"
      ? data.submissions
      : data.submissions.filter((submission) => submission.mission_id === selectedMissionId);
  const filteredMediaFiles =
    selectedMissionId === "all"
      ? data.mediaFiles
      : data.mediaFiles.filter((file) => file.mission_id === selectedMissionId);
  const filteredScoreItems =
    selectedMissionId === "all"
      ? data.scoreItems
      : data.scoreItems.filter((item) => item.mission_id === selectedMissionId);
  const scoreItemsBySource = groupScoreItemsBySource(filteredScoreItems);
  const scoreboardByTeam = new Map(data.scoreboard.map((row) => [row.team_id, row]));
  const totalApprovedScore = filteredScoreItems.reduce((sum, item) => sum + item.awarded_score, 0);
  const pendingScoreItemCount = filteredScoreItems.filter((item) => item.review_status === "pending").length;

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Teacher Dashboard</p>
          <h1>教師後台</h1>
        </div>
        <button className="secondary-button" disabled={loading} onClick={onRefresh}>
          重新整理
        </button>
      </div>
      <p className={status.includes("已") ? "success-text" : "warning-text"}>{status}</p>
      <div className="dashboard-grid">
        <article>
          <span>小組數</span>
          <strong>{data.teams.length}</strong>
        </article>
        <article>
          <span>作答筆數</span>
          <strong>{filteredSubmissions.length}</strong>
        </article>
        <article>
          <span>媒體檔案</span>
          <strong>{filteredMediaFiles.length}</strong>
        </article>
        <article>
          <span>已核得分</span>
          <strong>{totalApprovedScore}</strong>
        </article>
        <article>
          <span>待審核得分項</span>
          <strong>{pendingScoreItemCount}</strong>
        </article>
      </div>

      <div className="teacher-toolbar">
        <label>
          依關卡篩選
          <select value={selectedMissionId} onChange={(event) => setSelectedMissionId(event.target.value)}>
            <option value="all">全部關卡</option>
            {data.missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name_zh} / {mission.name_en}
              </option>
            ))}
          </select>
        </label>
        <div className="teacher-toolbar-actions">
          <button className="secondary-button" onClick={() => setCollapsedTeamIds({})}>
            全部展開
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              setCollapsedTeamIds(Object.fromEntries(data.teams.map((teamItem) => [teamItem.id, true])))
            }
          >
            全部收合
          </button>
          <button
            className="primary-button"
            onClick={() => downloadTeacherSummaryCsv(data, filteredSubmissions, filteredMediaFiles)}
          >
            下載作答彙整表
          </button>
        </div>
      </div>

      <TeacherScoreboardTable rows={data.scoreboard} />

      <div className="teacher-team-list">
        {data.teams.map((teamItem) => {
          const teamSubmissions = filteredSubmissions.filter((submission) => submission.team_id === teamItem.id);
          const teamMediaFiles = filteredMediaFiles.filter((file) => file.team_id === teamItem.id);
          const teamBatchScoreItems = filteredScoreItems.filter(
            (item) => item.team_id === teamItem.id && item.review_status !== "approved",
          );
          const teamScore = scoreboardByTeam.get(teamItem.id);
          const isExpanded = !collapsedTeamIds[teamItem.id];

          return (
            <article className="teacher-team-card" key={teamItem.id}>
              <div className="section-heading">
                <div>
                  <h2>{teamItem.team_name}</h2>
                  <p>
                    隊伍代碼：{teamItem.team_code}　通關碼：{teamItem.passcode_plaintext}
                  </p>
                </div>
                <div className="teacher-card-actions">
                  <span className="status-pill">{teamItem.locked ? "已鎖定" : "進行中"}</span>
                  <button
                    className="primary-button"
                    disabled={teamBatchScoreItems.length === 0 || actionBusy === `approve-team-${teamItem.id}`}
                    onClick={() =>
                      onApproveTeamScoreItems(
                        teamItem.id,
                        teamItem.team_name,
                        teamBatchScoreItems.map((item) => item.id),
                      )
                    }
                  >
                    本組批次通過 {teamBatchScoreItems.length ? `(${teamBatchScoreItems.length})` : ""}
                  </button>
                  <button
                    className="danger-button"
                    disabled={actionBusy === `delete-${teamItem.id}`}
                    onClick={() => onDeleteTeamData(teamItem.id, teamItem.team_name)}
                  >
                    刪除本組資料
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setCollapsedTeamIds((current) => ({
                        ...current,
                        [teamItem.id]: isExpanded,
                      }))
                    }
                  >
                    {isExpanded ? "收合" : "展開"}
                  </button>
                </div>
              </div>

              <div className="teacher-team-summary">
                <span>作答 {teamSubmissions.length} 筆</span>
                <span>檔案 {teamMediaFiles.length} 個</span>
                <span>總分 {teamScore?.total_score ?? 0}</span>
                <span>待審核 {teamScore?.pending_count ?? 0}</span>
              </div>

              {isExpanded ? (
                <>
                  <h3>文字作答</h3>
                  {teamSubmissions.length ? (
                    <div className="teacher-record-list">
                      {teamSubmissions.map((submission) => {
                        const mission = data.missions.find((item) => item.id === submission.mission_id);
                        const missionName = mission?.name_zh ?? "未命名關卡";
                        const sourceScoreItems =
                          scoreItemsBySource.get(buildScoreSourceKey("submissions", submission.id)) ?? [];
                        return (
                          <div className="teacher-record" key={submission.id}>
                            <strong>{missionName}</strong>
                            <span>{mission?.name_en ?? submission.mission_id}</span>
                            <div className="teacher-record-actions">
                              <span className="status-pill">{formatSubmissionStatus(submission.status)}</span>
                              <div className="teacher-inline-actions">
                                <button
                                  className="secondary-button"
                                  disabled={submission.status === "approved" || actionBusy === `approve-${submission.id}`}
                                  onClick={() => onApproveSubmission(submission.id)}
                                >
                                  {submission.status === "approved" ? "已通過" : "審核通過"}
                                </button>
                                <button
                                  className="danger-button"
                                  disabled={actionBusy === `delete-submission-${submission.id}`}
                                  onClick={() => onDeleteSubmission(submission.id, missionName)}
                                >
                                  刪除這筆作答
                                </button>
                              </div>
                            </div>
                            <pre>{formatAnswerJson(submission.answer_json)}</pre>
                            <ScoreItemList
                              items={sourceScoreItems}
                              actionBusy={actionBusy}
                              onApprove={onApproveScoreItem}
                              onReject={onRejectScoreItem}
                              onReset={onResetScoreItem}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">尚無作答資料。</p>
                  )}

                  <h3>已上傳檔案</h3>
                  {teamMediaFiles.length ? (
                    <div className="teacher-record-list">
                      {teamMediaFiles.map((file) => {
                        const mission = data.missions.find((item) => item.id === file.mission_id);
                        const mediaLabel = file.type === "photo" ? "照片" : "錄音";
                        const sourceScoreItems = scoreItemsBySource.get(buildScoreSourceKey("media_files", file.id)) ?? [];
                        return (
                          <div className="teacher-record" key={file.id}>
                            <strong>{mediaLabel}：{mission?.name_zh ?? "未指定關卡"}</strong>
                            <span>{file.mime_type ?? "unknown"}，{formatFileSize(file.file_size)}</span>
                            <div className="teacher-record-actions">
                              {file.type === "photo" ? (
                                <span className="status-pill">{formatMediaReviewStatus(file.review_status)}</span>
                              ) : (
                                <span className="status-pill">錄音檔</span>
                              )}
                              <div className="teacher-inline-actions">
                                {file.type === "photo" ? (
                                  <button
                                    className="secondary-button"
                                    disabled={file.review_status === "approved" || actionBusy === `approve-media-${file.id}`}
                                    onClick={() => onApproveMediaFile(file.id)}
                                  >
                                    {file.review_status === "approved" ? "照片已通過" : "照片審核通過"}
                                  </button>
                                ) : null}
                                <button
                                  className="danger-button"
                                  disabled={actionBusy === `delete-media-${file.id}`}
                                  onClick={() => onDeleteMediaFile(file.id, mediaLabel)}
                                >
                                  刪除檔案
                                </button>
                              </div>
                            </div>
                            {file.signed_url ? (
                              <>
                                {file.type === "photo" ? (
                                  <img className="teacher-photo-preview" src={file.signed_url} alt="學生上傳照片" />
                                ) : (
                                  <audio className="teacher-audio-preview" controls src={file.signed_url}>
                                    <a href={file.signed_url} target="_blank" rel="noreferrer">
                                      開啟錄音檔案
                                    </a>
                                  </audio>
                                )}
                                <a href={file.signed_url} target="_blank" rel="noreferrer">
                                  開啟檔案
                                </a>
                              </>
                            ) : (
                              <span>暫時無法產生檔案連結</span>
                            )}
                            <ScoreItemList
                              items={sourceScoreItems}
                              actionBusy={actionBusy}
                              onApprove={onApproveScoreItem}
                              onReject={onRejectScoreItem}
                              onReset={onResetScoreItem}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">尚無上傳檔案。</p>
                  )}
                </>
              ) : (
                <p className="muted">已收合。展開後可查看作答與檔案。</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeacherScoreboardTable({
  rows,
}: {
  rows: TeacherDashboardData["scoreboard"];
}) {
  if (!rows.length) {
    return (
      <section className="teacher-scoreboard">
        <h3>各組得分統整表</h3>
        <p className="muted">尚未產生得分資料。學生作答或上傳檔案後，系統會建立待審核得分項目。</p>
      </section>
    );
  }

  return (
    <section className="teacher-scoreboard">
      <div className="section-heading">
        <div>
          <h3>各組得分統整表</h3>
          <p className="muted">依老師審核通過的得分項目計算，待審核項目不列入總分。</p>
        </div>
      </div>
      <div className="scoreboard-table-wrap">
        <table className="scoreboard-table">
          <thead>
            <tr>
              <th>小組</th>
              <th>總分</th>
              <th>通過</th>
              <th>待審核</th>
              <th>退回</th>
              <th>228 公園</th>
              <th>台博館</th>
              <th>古生物館</th>
              <th>台北車站</th>
              <th>世界朋友</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team_id}>
                <th scope="row">
                  <strong>{row.team_name}</strong>
                  <span>{row.team_code}</span>
                </th>
                <td className="scoreboard-total">{row.total_score}</td>
                <td>{row.approved_count}</td>
                <td>{row.pending_count}</td>
                <td>{row.rejected_count}</td>
                <td>{row.peace_park_score}</td>
                <td>{row.ntm_main_score}</td>
                <td>{row.paleontology_score}</td>
                <td>{row.taipei_station_score}</td>
                <td>{row.world_friend_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoreItemList({
  items,
  actionBusy,
  onApprove,
  onReject,
  onReset,
}: {
  items: TeacherDashboardData["scoreItems"];
  actionBusy: string | null;
  onApprove: (scoreItemId: string) => void;
  onReject: (scoreItemId: string, label: string) => void;
  onReset: (scoreItemId: string, label: string) => void;
}) {
  if (!items.length) {
    return <p className="muted">尚未產生得分項目。</p>;
  }

  return (
    <div className="score-item-list">
      {items.map((item) => {
        const label = item.item_label_zh || item.item_label_en;
        return (
          <div className="score-item-row" key={item.id}>
            <div>
              <strong>{label}</strong>
              <span>
                {formatScoreType(item.score_type)} · {item.awarded_score} / {item.max_score} 分
              </span>
              {item.review_note ? <small>退回原因：{item.review_note}</small> : null}
            </div>
            <div className="teacher-inline-actions">
              <span className="status-pill">{formatScoreReviewStatus(item.review_status)}</span>
              <button
                className="secondary-button"
                disabled={item.review_status === "approved" || actionBusy === `approve-score-${item.id}`}
                onClick={() => onApprove(item.id)}
              >
                通過
              </button>
              <button
                className="danger-button"
                disabled={item.review_status === "rejected" || actionBusy === `reject-score-${item.id}`}
                onClick={() => onReject(item.id, label)}
              >
                退回
              </button>
              <button
                className="secondary-button"
                disabled={item.review_status === "pending" || actionBusy === `reset-score-${item.id}`}
                onClick={() => onReset(item.id, label)}
              >
                重設
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeacherDashboard({
  team,
  drafts,
  completedCount,
}: {
  team: TeamDraft;
  drafts: Record<string, MissionDraft>;
  completedCount: number;
}) {
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Teacher Dashboard</p>
          <h1>教師後台</h1>
        </div>
        <span className="status-pill">入口已開啟</span>
      </div>
      <div className="dashboard-grid">
        <article>
          <span>隊名</span>
          <strong>{team.teamName || "尚未建立"}</strong>
        </article>
        <article>
          <span>通關碼</span>
          <strong>{team.passcode || "尚未設定"}</strong>
        </article>
        <article>
          <span>完成進度</span>
          <strong>{completedCount} / {missions.length}</strong>
        </article>
      </div>
      <div className="review-list">
        {missions.map((mission) => (
          <div className="review-row" key={mission.id}>
            <div>
              <strong>{mission.titleZh}</strong>
              <span>{mission.titleEn}</span>
            </div>
            <mark>{isMissionComplete(mission, drafts[mission.id]) ? "已完成" : "草稿"}</mark>
          </div>
        ))}
      </div>
    </section>
  );
}

function downloadTeacherSummaryCsv(
  data: TeacherDashboardData,
  submissions: TeacherDashboardData["submissions"],
  mediaFiles: TeacherDashboardData["mediaFiles"],
) {
  const headers = [
    "隊名",
    "隊伍代碼",
    "通關碼",
    "關卡中文",
    "關卡英文",
    "作答狀態",
    "作答內容",
    "媒體檔案數",
    "媒體檔案連結",
    "小組總分",
    "通過得分項",
    "待審核得分項",
    "退回得分項",
    "更新時間",
  ];

  const rows = submissions.map((submission) => {
    const teamItem = data.teams.find((item) => item.id === submission.team_id);
    const mission = data.missions.find((item) => item.id === submission.mission_id);
    const teamScore = data.scoreboard.find((item) => item.team_id === submission.team_id);
    const missionMediaFiles = mediaFiles.filter(
      (file) => file.team_id === submission.team_id && file.mission_id === submission.mission_id,
    );

    return [
      teamItem?.team_name ?? "",
      teamItem?.team_code ?? "",
      teamItem?.passcode_plaintext ?? "",
      mission?.name_zh ?? "",
      mission?.name_en ?? submission.mission_id,
      submission.status,
      formatAnswerJson(submission.answer_json),
      String(missionMediaFiles.length),
      missionMediaFiles.map((file) => file.signed_url ?? file.storage_path).join("\n"),
      String(teamScore?.total_score ?? 0),
      String(teamScore?.approved_count ?? 0),
      String(teamScore?.pending_count ?? 0),
      String(teamScore?.rejected_count ?? 0),
      submission.updated_at,
    ];
  });

  const mediaOnlyRows = mediaFiles
    .filter(
      (file) =>
        !submissions.some(
          (submission) => submission.team_id === file.team_id && submission.mission_id === file.mission_id,
        ),
    )
    .map((file) => {
      const teamItem = data.teams.find((item) => item.id === file.team_id);
      const mission = data.missions.find((item) => item.id === file.mission_id);
      const teamScore = data.scoreboard.find((item) => item.team_id === file.team_id);
      return [
        teamItem?.team_name ?? "",
        teamItem?.team_code ?? "",
        teamItem?.passcode_plaintext ?? "",
        mission?.name_zh ?? "",
        mission?.name_en ?? file.mission_id ?? "",
        "media_only",
        "",
        "1",
        file.signed_url ?? file.storage_path,
        String(teamScore?.total_score ?? 0),
        String(teamScore?.approved_count ?? 0),
        String(teamScore?.pending_count ?? 0),
        String(teamScore?.rejected_count ?? 0),
        file.created_at,
      ];
    });

  const csv = [headers, ...rows, ...mediaOnlyRows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `台北之心作答彙整_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatAnswerJson(answer: Record<string, unknown>) {
  const lines = [
    answer.keyword ? `核心單字：${answer.keyword}` : "",
    answer.sentence ? `英文句子：${answer.sentence}` : "",
    formatWorldFriendsAnswer(answer),
    formatMuseumCategoriesAnswer(answer.museum_categories),
    formatObjectAnswer("古生物資料", answer.paleontology),
    formatObjectAnswer("車站標示", answer.station_signs),
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : JSON.stringify(answer, null, 2);
}

function formatWorldFriendsAnswer(answer: Record<string, unknown>) {
  const worldFriends = Array.isArray(answer.world_friends) ? answer.world_friends : [];
  if (worldFriends.length) {
    return worldFriends
      .map((item, index) => {
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        const country = String(record.countryText ?? record.country_text ?? "").trim() || "未填國家";
        const photoName = String(record.photoName ?? record.photo_name ?? "").trim();
        return `外國朋友第 ${index + 1} 組：${country}${photoName ? `（照片：${photoName}）` : ""}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return answer.country_text ? `外國朋友國家：${answer.country_text}` : "";
}

function formatObjectAnswer(label: string, value: unknown) {
  if (!value) return "";
  if (Array.isArray(value) && value.length === 0) return "";
  if (!Array.isArray(value) && typeof value === "object" && Object.keys(value).length === 0) return "";
  return `${label}：${JSON.stringify(value, null, 2)}`;
}

function formatMuseumCategoriesAnswer(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const labels: Record<string, string> = {
    regulatory: "Regulatory",
    informational: "Informational",
    safety: "Safety",
    exhibition: "Exhibition",
  };

  const sections = Object.entries(labels)
    .map(([key, label]) => {
      const entries = (value as Record<string, unknown>)[key];
      if (!Array.isArray(entries)) return "";

      const lines = entries
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return "";
          const record = entry as Record<string, unknown>;
          const word = String(record.word ?? "").trim();
          const chinese = String(record.chinese ?? "").trim();
          return word || chinese ? `${index + 1}. ${word}${chinese ? `：${chinese}` : ""}` : "";
        })
        .filter(Boolean);

      return lines.length ? `${label}\n${lines.join("\n")}` : "";
    })
    .filter(Boolean);

  return sections.length ? `博物館英文分類卡：\n${sections.join("\n")}` : "";
}

function formatFileSize(size: number | null) {
  if (!size) return "未知大小";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatSubmissionStatus(status: string) {
  if (status === "approved") return "老師已審核通過";
  if (status === "completed") return "學生已完成";
  if (status === "synced") return "已儲存";
  return "草稿";
}

function formatMediaReviewStatus(status: string | null) {
  return status === "approved" ? "照片已審核通過" : "照片待審核";
}

function formatScoreReviewStatus(status: string) {
  if (status === "approved") return "已得分";
  if (status === "rejected") return "已退回";
  return "待審核";
}

function formatScoreType(type: string) {
  if (type === "word_pair") return "英文中文配對";
  if (type === "photo") return "照片";
  if (type === "audio") return "錄音";
  if (type === "world_friend") return "外國朋友互動";
  return "文字欄位";
}

function buildScoreSourceKey(sourceTable: string, sourceId: string) {
  return `${sourceTable}:${sourceId}`;
}

function groupScoreItemsBySource(items: TeacherDashboardData["scoreItems"]) {
  const result = new Map<string, TeacherDashboardData["scoreItems"]>();

  for (const item of items) {
    const key = buildScoreSourceKey(item.source_table, item.source_id);
    const current = result.get(key) ?? [];
    current.push(item);
    result.set(key, current);
  }

  for (const entries of result.values()) {
    entries.sort((a, b) => a.item_key.localeCompare(b.item_key, "zh-TW"));
  }

  return result;
}

function isMissionComplete(mission: Mission, draft?: MissionDraft) {
  if (!draft) return false;
  if (mission.type === "photo_text") {
    return Boolean(draft.photoName && draft.keyword && draft.sentence);
  }
  if (mission.type === "audio") {
    return Boolean(draft.audioName && draft.paleontology && Object.keys(draft.paleontology).length >= 5);
  }
  if (mission.type === "station_sign") {
    return countStationSignPhotos(draft) > 0;
  }
  if (mission.type === "world_friend") {
    return hasCompletedWorldFriendEntry(draft);
  }
  if (mission.type === "info_card") {
    return hasMuseumCategoryAnswers(draft);
  }
  return true;
}

function hasMuseumCategoryAnswers(draft?: MissionDraft) {
  const categories = normalizeMuseumCategories(draft);
  return Object.values(categories).every((entries) =>
    entries.some((entry) => entry.word.trim() && entry.chinese.trim()),
  );
}

function normalizeStationSigns(draft?: MissionDraft) {
  const stationPurposeOptions = [
    "Location information",
    "Direction guidance",
    "Machine operation",
    "Arrival / departure information",
    "Service / safety",
  ];

  return stationPurposeOptions.map((purpose, index) => ({
    english: draft?.stationSigns?.[index]?.english ?? "",
    chinese: draft?.stationSigns?.[index]?.chinese ?? "",
    purpose,
    location: "",
    photoName: draft?.stationSigns?.[index]?.photoName,
  }));
}

function countStationSignPhotos(draft?: MissionDraft) {
  return normalizeStationSigns(draft).filter((sign) => Boolean(sign.photoName)).length;
}

function normalizeMuseumCategories(draft?: MissionDraft) {
  const categoryIds = ["regulatory", "informational", "safety", "exhibition"];
  const result = Object.fromEntries(
    categoryIds.map((categoryId) => [
      categoryId,
      Array.from({ length: 5 }, (_, index) => ({
        word: draft?.museumCategories?.[categoryId]?.[index]?.word ?? "",
        chinese: draft?.museumCategories?.[categoryId]?.[index]?.chinese ?? "",
      })),
    ]),
  );

  return result;
}

function hasCompletedWorldFriendEntry(draft?: MissionDraft) {
  return normalizeWorldFriendEntries(draft).some((entry) => entry.countryText.trim() && entry.photoName);
}

function normalizeWorldFriendEntries(draft?: MissionDraft): WorldFriendEntry[] {
  if (draft?.worldFriends?.length) {
    return draft.worldFriends.map((entry) => ({
      id: entry.id || createWorldFriendEntryId(),
      countryText: entry.countryText ?? "",
      photoName: entry.photoName,
    }));
  }

  return [
    {
      id: "world-friend-1",
      countryText: draft?.countryText ?? "",
      photoName: draft?.photoName,
    },
  ];
}

function createWorldFriendEntryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `world-friend-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function toFriendlySubmissionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNSUPPORTED_PHOTO_TYPE")) return "照片格式目前支援 JPG、PNG、WebP。";
  if (message.includes("UNSUPPORTED_AUDIO_TYPE")) return "錄音格式目前支援 WebM、MP4、MP3、M4A。";
  if (message.includes("MEDIA_FILE_TOO_LARGE")) return "檔案超過 10 MB，請先壓縮或更換檔案。";
  if (message.includes("SUPABASE_NOT_CONFIGURED")) return "尚未設定 Supabase，無法儲存作答。";
  if (message.includes("permission denied") || message.includes("violates row-level security")) {
    return "Supabase 權限不允許儲存，請確認小組已登入。";
  }
  if (message.includes("Failed to fetch")) return "暫時無法連線到 Supabase，請檢查網路後再試。";
  return `儲存失敗：${message}`;
}

function toFriendlyTeacherError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("SUPABASE_NOT_CONFIGURED")) return "尚未設定 Supabase，無法讀取教師後台資料。";
  if (message.includes("INVALID_TEACHER_ACCESS_CODE")) return "教師後台密碼不正確。";
  if (message.includes("AUTH_REQUIRED") || message.includes("AUTH_SESSION_NOT_CREATED")) {
    return "無法建立教師登入狀態，請重新整理後再試。";
  }
  if (message.includes("permission denied") || message.includes("violates row-level security")) {
    return "Supabase 權限尚未允許讀取後台資料，請確認教師權限已建立。";
  }
  if (message.includes("Failed to fetch")) return "暫時無法連線到 Supabase，請檢查網路後再試。";
  return `教師後台讀取失敗：${message}`;
}

function toFriendlyTeamError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("TEAM_NAME_REQUIRED")) return "請先輸入隊名或隊伍代碼。";
  if (message.includes("PASSCODE_TOO_SHORT")) return "通關碼至少需要 4 個字元。";
  if (message.includes("TEAM_SIZE_OUT_OF_RANGE")) return "小組人數需符合活動設定。";
  if (message.includes("TEAM_NOT_FOUND")) return "找不到這個隊伍，請確認隊名或隊伍代碼。";
  if (message.includes("INVALID_PASSCODE")) return "通關碼不正確，請再確認。";
  if (message.includes("ACTIVE_ACTIVITY_NOT_FOUND")) return "目前找不到啟用中的活動。";
  if (message.includes("Failed to fetch")) return "無法連線到 Supabase，請檢查網路與環境變數。";
  return `小組操作失敗：${message}`;
}
