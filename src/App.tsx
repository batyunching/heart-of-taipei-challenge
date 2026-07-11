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
  loadMissionIdMap,
  saveMissionSubmission,
  type MissionIdMap,
} from "./lib/submissionApi";
import {
  loadTeacherDashboard,
  registerTeacher,
  type TeacherDashboardData,
} from "./lib/teacherApi";
import { createTeam, loginTeam } from "./lib/teamApi";
import type { Mission, MissionDraft, PageKey, SupabaseTeam, TeamDraft } from "./types/mission";

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
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [team, setTeam] = useState<TeamDraft>(() => loadTeam() ?? defaultTeam);
  const [connectedTeam, setConnectedTeam] = useState<SupabaseTeam | null>(() => loadConnectedTeam());
  const [teamSyncStatus, setTeamSyncStatus] = useState(() =>
    connectedTeam ? `已登入小組：${connectedTeam.team_name}，隊伍代碼 ${connectedTeam.team_code}` : "尚未連線到 Supabase 小組。",
  );
  const [teamActionBusy, setTeamActionBusy] = useState(false);
  const [missionIdMap, setMissionIdMap] = useState<MissionIdMap>({});
  const [missionSyncStatus, setMissionSyncStatus] = useState<Record<string, string>>({});
  const [savingMissionId, setSavingMissionId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Partial<Record<MediaType, File>>>>({});
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
        if (!cancelled) setMissionIdMap(map);
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

  async function uploadSelectedMediaForMission(missionId: string, dbMissionId: string, teamId: string) {
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
      await saveMissionSubmission({
        teamId: connectedTeam.id,
        missionId: dbMissionId,
        draft,
        status: isMissionComplete(mission, draft) ? "completed" : "synced",
      });
      setSelectedFiles((current) => ({
        ...current,
        [mission.id]: {},
      }));
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
            onFileSelected={selectMissionFile}
            onSave={() => handleSaveMission(missions.find((mission) => mission.id === "world-friend")!)}
            saveStatus={missionSyncStatus["world-friend"] ?? missionSyncStatus.system}
            saveDisabled={!connectedTeam || savingMissionId === "world-friend"}
          />
        ) : null}
        {activePage === "review_submit" ? <ReviewSection drafts={drafts} /> : null}
        {pageMissions
          .filter((mission) => mission.type !== "world_friend")
          .map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              draft={drafts[mission.id]}
              updateDraft={updateDraft}
              onFileSelected={selectMissionFile}
              onSave={() => handleSaveMission(mission)}
              saveStatus={missionSyncStatus[mission.id] ?? missionSyncStatus.system}
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

function MissionCard({
  mission,
  draft,
  updateDraft,
  onFileSelected,
  onSave,
  saveStatus,
  saveDisabled,
}: {
  mission: Mission;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
  onSave: () => void;
  saveStatus?: string;
  saveDisabled: boolean;
}) {
  return (
    <article className="mission-card">
      <div className="mission-title">
        <div>
          <h3>{mission.titleZh}</h3>
          <p>{mission.titleEn}</p>
        </div>
        <span>{isMissionComplete(mission, draft) ? "已完成" : "草稿"}</span>
      </div>
      <p>{mission.introEn}</p>
      <p className="muted">{mission.introZh}</p>
      <div className="keyword-row">
        {mission.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>

      {mission.type === "info_card" ? <MuseumEnglishCards /> : null}
      {mission.type === "audio" ? (
        <PaleontologyFields
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          onFileSelected={onFileSelected}
        />
      ) : null}
      {mission.type === "station_sign" ? (
        <StationSigns
          missionId={mission.id}
          draft={draft}
          updateDraft={updateDraft}
          onFileSelected={onFileSelected}
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
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
}) {
  const value = draft?.paleontology ?? {};
  const fields = [
    ["name", "name"],
    ["type", "fossil or prehistoric animal"],
    ["lived", "when it lived"],
    ["ate", "what it ate"],
    ["fact", "interesting fact"],
  ];

  return (
    <div className="form-grid">
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
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
        <p>It lived ____.</p>
        <p>It ate ____.</p>
        <p>One interesting fact is ____.</p>
      </div>
      <label>
        錄音檔
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
  onFileSelected,
}: {
  missionId: string;
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
}) {
  const signs = draft?.stationSigns ?? Array.from({ length: 6 }, () => ({
    english: "",
    chinese: "",
    purpose: "Transportation",
    location: "",
  }));

  return (
    <div className="sign-list">
      {signs.map((sign, index) => (
        <div className="sign-row" key={index}>
          <input
            value={sign.english}
            onChange={(event) => {
              const next = [...signs];
              next[index] = { ...sign, english: event.target.value };
              updateDraft(missionId, { stationSigns: next });
            }}
            placeholder="English"
          />
          <input
            value={sign.chinese}
            onChange={(event) => {
              const next = [...signs];
              next[index] = { ...sign, chinese: event.target.value };
              updateDraft(missionId, { stationSigns: next });
            }}
            placeholder="中文"
          />
          <select
            value={sign.purpose}
            onChange={(event) => {
              const next = [...signs];
              next[index] = { ...sign, purpose: event.target.value };
              updateDraft(missionId, { stationSigns: next });
            }}
          >
            <option>Transportation</option>
            <option>Direction</option>
            <option>Service</option>
            <option>Safety</option>
          </select>
          <input
            value={sign.location}
            onChange={(event) => {
              const next = [...signs];
              next[index] = { ...sign, location: event.target.value };
              updateDraft(missionId, { stationSigns: next });
            }}
            placeholder="位置"
          />
        </div>
      ))}
      <label>
        任務照片
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFileSelected(missionId, "photo", event.target.files?.[0])}
        />
      </label>
    </div>
  );
}

function MuseumEnglishCards() {
  const cards = [
    ["Regulatory", "Rules or instructions visitors should follow.", "No flash photography."],
    ["Informational", "Helpful facts and visitor information.", "Information desk."],
    ["Safety", "Signs that protect visitors.", "Emergency exit."],
    ["Exhibition", "Words used in displays.", "Permanent exhibition."],
  ];
  return (
    <div className="info-card-grid">
      {cards.map(([title, use, example]) => (
        <article className="info-card" key={title}>
          <strong>{title}</strong>
          <p>{use}</p>
          <span>{example}</span>
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
  saveDisabled,
}: {
  draft?: MissionDraft;
  updateDraft: (id: string, patch: MissionDraft) => void;
  onFileSelected: (id: string, type: MediaType, file: File | undefined) => void;
  onSave: () => void;
  saveStatus?: string;
  saveDisabled: boolean;
}) {
  const [speechWarning, setSpeechWarning] = useState("");

  return (
    <article className="mission-card highlight-card">
      <div className="mission-title">
        <div>
          <h3>訪談句型</h3>
          <p>Interview Prompts</p>
        </div>
        <span>{draft?.interviewCompleted && draft.countryText && draft.photoName ? "已完成" : "草稿"}</span>
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
      <div className="form-grid">
        <label>
          外國朋友的國家
          <input
            value={draft?.countryText ?? ""}
            onChange={(event) => updateDraft("world-friend", { countryText: event.target.value })}
            placeholder="自由輸入，例如：Japan"
          />
        </label>
        <label>
          合照照片
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onFileSelected("world-friend", "photo", event.target.files?.[0])}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft?.interviewCompleted ?? false}
            onChange={(event) => updateDraft("world-friend", { interviewCompleted: event.target.checked })}
          />
          已完成訪談 Interview completed
        </label>
      </div>
      <SubmissionActions onSave={onSave} saveStatus={saveStatus} saveDisabled={saveDisabled} />
    </article>
  );
}

function ReviewSection({ drafts }: { drafts: Record<string, MissionDraft> }) {
  return (
    <div className="review-list">
      {missions.map((mission) => (
        <div className="review-row" key={mission.id}>
          <div>
            <strong>{mission.titleZh}</strong>
            <span>{mission.titleEn}</span>
          </div>
          <mark>{isMissionComplete(mission, drafts[mission.id]) ? "已完成" : "尚有缺漏"}</mark>
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
}: {
  data: TeacherDashboardData | null;
  status: string;
  loading: boolean;
  onRefresh: () => void;
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

      <div className="teacher-team-list">
        {data.teams.map((teamItem) => {
          const teamSubmissions = filteredSubmissions.filter((submission) => submission.team_id === teamItem.id);
          const teamMediaFiles = filteredMediaFiles.filter((file) => file.team_id === teamItem.id);
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
              </div>

              {isExpanded ? (
                <>
                  <h3>文字作答</h3>
                  {teamSubmissions.length ? (
                    <div className="teacher-record-list">
                      {teamSubmissions.map((submission) => {
                        const mission = data.missions.find((item) => item.id === submission.mission_id);
                        return (
                          <div className="teacher-record" key={submission.id}>
                            <strong>{mission?.name_zh ?? "未命名關卡"}</strong>
                            <span>{mission?.name_en ?? submission.mission_id}</span>
                            <pre>{formatAnswerJson(submission.answer_json)}</pre>
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
                        return (
                          <div className="teacher-record" key={file.id}>
                            <strong>{file.type === "photo" ? "照片" : "錄音"}：{mission?.name_zh ?? "未指定關卡"}</strong>
                            <span>{file.mime_type ?? "unknown"}，{formatFileSize(file.file_size)}</span>
                            {file.signed_url ? (
                              <a href={file.signed_url} target="_blank" rel="noreferrer">
                                開啟檔案
                              </a>
                            ) : (
                              <span>暫時無法產生檔案連結</span>
                            )}
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
    "更新時間",
  ];

  const rows = submissions.map((submission) => {
    const teamItem = data.teams.find((item) => item.id === submission.team_id);
    const mission = data.missions.find((item) => item.id === submission.mission_id);
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
    answer.country_text ? `外國朋友國家：${answer.country_text}` : "",
    answer.interview_completed ? "訪談狀態：已完成" : "",
    formatObjectAnswer("古生物資料", answer.paleontology),
    formatObjectAnswer("車站標示", answer.station_signs),
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : JSON.stringify(answer, null, 2);
}

function formatObjectAnswer(label: string, value: unknown) {
  if (!value) return "";
  if (Array.isArray(value) && value.length === 0) return "";
  if (!Array.isArray(value) && typeof value === "object" && Object.keys(value).length === 0) return "";
  return `${label}：${JSON.stringify(value, null, 2)}`;
}

function formatFileSize(size: number | null) {
  if (!size) return "未知大小";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
    return Boolean(
      draft.photoName &&
        (draft.stationSigns ?? []).filter((sign) => sign.english && sign.chinese && sign.location).length >= 6,
    );
  }
  if (mission.type === "world_friend") {
    return Boolean(draft.countryText && draft.photoName && draft.interviewCompleted);
  }
  return true;
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
