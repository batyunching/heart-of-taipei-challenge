import { supabase } from "./supabase";

const MEDIA_BUCKET = "taipei-challenge-media";

export type MediaType = "photo" | "audio";

export interface UploadedMediaFile {
  id: string;
  storage_path: string;
  type: MediaType;
}

export async function uploadMissionMedia({
  teamId,
  missionId,
  file,
  type,
}: {
  teamId: string;
  missionId: string;
  file: File;
  type: MediaType;
}): Promise<UploadedMediaFile> {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  assertAllowedFile(file, type);

  const storagePath = buildStoragePath({ teamId, missionId, file, type });
  const upload = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    throw upload.error;
  }

  const { data, error } = await supabase
    .from("media_files")
    .insert({
      team_id: teamId,
      mission_id: missionId,
      type,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      upload_status: "uploaded",
    })
    .select("id,storage_path,type")
    .single();

  if (error) {
    throw error;
  }

  return data as UploadedMediaFile;
}

function assertAllowedFile(file: File, type: MediaType) {
  const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedAudioTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/x-m4a"];
  const allowedTypes = type === "photo" ? allowedPhotoTypes : allowedAudioTypes;

  if (!allowedTypes.includes(file.type)) {
    throw new Error(type === "photo" ? "UNSUPPORTED_PHOTO_TYPE" : "UNSUPPORTED_AUDIO_TYPE");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("MEDIA_FILE_TOO_LARGE");
  }
}

function buildStoragePath({
  teamId,
  missionId,
  file,
  type,
}: {
  teamId: string;
  missionId: string;
  file: File;
  type: MediaType;
}) {
  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const suffix = safeName || `${type}-upload`;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `teams/${teamId}/missions/${missionId}/${type}-${nonce}-${suffix}`;
}
