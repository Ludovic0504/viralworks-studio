/**
 * Persistance locale du workflow « Éditer ma vidéo » (par utilisateur).
 * Métadonnées → localStorage ; vidéo source → IndexedDB.
 */

const META_PREFIX = "edit_video_workflow:";
const IDB_DB_NAME = "edit_video_workflow_db";
const IDB_DB_VERSION = 1;
const IDB_STORE = "blobs";

export type EditVideoWorkflowPhase = "draft" | "generating" | "done" | "error";

export type EditVideoWorkflowAvatar = {
  url: string;
  source: string;
} | null;

export type EditVideoWorkflowInstruction = {
  id: string;
  what: string;
  where: string;
  assetDataUrl: string | null;
};

export type EditVideoWorkflowMeta = {
  version: 1;
  savedAt: string;
  phase: EditVideoWorkflowPhase;
  videoFileName: string | null;
  videoMimeType: string | null;
  videoDurationSec: number;
  hasVideoBlob: boolean;
  selectedResolution: "480p" | "720p";
  selectionStartSec: number;
  selectionDurationSec: number;
  avatars: EditVideoWorkflowAvatar[];
  dialogueEnabled: boolean;
  refImageDataUrl: string | null;
  refImageMode: "final" | "inspiration";
  instructions: EditVideoWorkflowInstruction[];
  activeTile: "avatar" | "rendu" | "chg" | null;
  kieTaskId: string | null;
  resultVideoUrl: string | null;
  generateError: string | null;
};

export type EditVideoWorkflowSnapshot = {
  phase: EditVideoWorkflowPhase;
  videoFile: File | null;
  videoDurationSec: number;
  selectedResolution: "480p" | "720p";
  selectionStartSec: number;
  selectionDurationSec: number;
  avatars: EditVideoWorkflowAvatar[];
  dialogueEnabled: boolean;
  refImageDataUrl: string | null;
  refImageMode: "final" | "inspiration";
  instructions: EditVideoWorkflowInstruction[];
  activeTile: "avatar" | "rendu" | "chg" | null;
  kieTaskId: string | null;
  resultVideoUrl: string | null;
  generateError: string | null;
};

function metaKey(userId: string): string {
  return `${META_PREFIX}${userId}`;
}

function videoBlobKey(userId: string): string {
  return `video:${userId}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(false);
    }
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        db.close();
        const value = req.result;
        resolve(value instanceof Blob ? value : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(null);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve();
    }
  });
}

function isRefImageMode(value: unknown): value is "final" | "inspiration" {
  return value === "final" || value === "inspiration";
}

function isActiveTile(value: unknown): value is "avatar" | "rendu" | "chg" | null {
  return value === "avatar" || value === "rendu" || value === "chg" || value === null;
}

function isPhase(value: unknown): value is EditVideoWorkflowPhase {
  return value === "draft" || value === "generating" || value === "done" || value === "error";
}

function parseMeta(raw: string | null): EditVideoWorkflowMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EditVideoWorkflowMeta>;
    if (!parsed || parsed.version !== 1) return null;

    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      phase: isPhase(parsed.phase) ? parsed.phase : "draft",
      videoFileName: typeof parsed.videoFileName === "string" ? parsed.videoFileName : null,
      videoMimeType: typeof parsed.videoMimeType === "string" ? parsed.videoMimeType : null,
      videoDurationSec:
        typeof parsed.videoDurationSec === "number" && parsed.videoDurationSec >= 0
          ? parsed.videoDurationSec
          : 0,
      hasVideoBlob: parsed.hasVideoBlob === true,
      selectedResolution: parsed.selectedResolution === "720p" ? "720p" : "480p",
      selectionStartSec:
        typeof parsed.selectionStartSec === "number" && parsed.selectionStartSec >= 0
          ? parsed.selectionStartSec
          : 0,
      selectionDurationSec:
        typeof parsed.selectionDurationSec === "number" && parsed.selectionDurationSec > 0
          ? parsed.selectionDurationSec
          : 15,
      avatars: Array.isArray(parsed.avatars)
        ? parsed.avatars.map((a) =>
            a && typeof a === "object" && typeof a.url === "string"
              ? { url: a.url, source: typeof a.source === "string" ? a.source : "library" }
              : null,
          )
        : [null, null, null],
      dialogueEnabled: parsed.dialogueEnabled === true,
      refImageDataUrl: typeof parsed.refImageDataUrl === "string" ? parsed.refImageDataUrl : null,
      refImageMode: isRefImageMode(parsed.refImageMode) ? parsed.refImageMode : "final",
      instructions: Array.isArray(parsed.instructions)
        ? parsed.instructions
            .filter((row) => row && typeof row === "object" && typeof row.id === "string")
            .map((row) => ({
              id: row.id,
              what: typeof row.what === "string" ? row.what : "",
              where: typeof row.where === "string" ? row.where : "",
              assetDataUrl:
                typeof row.assetDataUrl === "string" ? row.assetDataUrl : null,
            }))
        : [],
      activeTile: isActiveTile(parsed.activeTile) ? parsed.activeTile : null,
      kieTaskId: typeof parsed.kieTaskId === "string" ? parsed.kieTaskId : null,
      resultVideoUrl: typeof parsed.resultVideoUrl === "string" ? parsed.resultVideoUrl : null,
      generateError: typeof parsed.generateError === "string" ? parsed.generateError : null,
    };
  } catch {
    return null;
  }
}

function snapshotToMeta(snapshot: EditVideoWorkflowSnapshot): EditVideoWorkflowMeta {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    phase: snapshot.phase,
    videoFileName: snapshot.videoFile?.name ?? null,
    videoMimeType: snapshot.videoFile?.type ?? null,
    videoDurationSec: snapshot.videoDurationSec,
    hasVideoBlob: Boolean(snapshot.videoFile),
    selectedResolution: snapshot.selectedResolution,
    selectionStartSec: snapshot.selectionStartSec,
    selectionDurationSec: snapshot.selectionDurationSec,
    avatars: snapshot.avatars,
    dialogueEnabled: snapshot.dialogueEnabled,
    refImageDataUrl: snapshot.refImageDataUrl,
    refImageMode: snapshot.refImageMode,
    instructions: snapshot.instructions,
    activeTile: snapshot.activeTile,
    kieTaskId: snapshot.kieTaskId,
    resultVideoUrl: snapshot.resultVideoUrl,
    generateError: snapshot.generateError,
  };
}

export function deriveEditVideoWorkflowPhase(input: {
  generating: boolean;
  resultVideoUrl: string | null;
  generateError: string | null;
  kieTaskId: string | null;
}): EditVideoWorkflowPhase {
  if (input.resultVideoUrl) return "done";
  if (input.generateError) return "error";
  if (input.generating || input.kieTaskId) return "generating";
  return "draft";
}

export async function loadEditVideoWorkflow(
  userId: string,
): Promise<EditVideoWorkflowSnapshot | null> {
  if (!userId || typeof localStorage === "undefined") return null;

  const meta = parseMeta(localStorage.getItem(metaKey(userId)));
  if (!meta) return null;

  let videoFile: File | null = null;
  if (meta.hasVideoBlob) {
    const blob = await idbGet(videoBlobKey(userId));
    if (blob) {
      videoFile = new File(
        [blob],
        meta.videoFileName || "video.mp4",
        { type: meta.videoMimeType || blob.type || "video/mp4" },
      );
    }
  }

  const avatars =
    meta.avatars.length === 3
      ? meta.avatars
      : [meta.avatars[0] ?? null, meta.avatars[1] ?? null, meta.avatars[2] ?? null];

  return {
    phase: meta.phase,
    videoFile,
    videoDurationSec: meta.videoDurationSec,
    selectedResolution: meta.selectedResolution,
    selectionStartSec: meta.selectionStartSec,
    selectionDurationSec: meta.selectionDurationSec,
    avatars,
    dialogueEnabled: meta.dialogueEnabled,
    refImageDataUrl: meta.refImageDataUrl,
    refImageMode: meta.refImageMode,
    instructions: meta.instructions,
    activeTile: meta.activeTile,
    kieTaskId: meta.kieTaskId,
    resultVideoUrl: meta.resultVideoUrl,
    generateError: meta.generateError,
  };
}

export async function saveEditVideoWorkflow(
  userId: string,
  snapshot: EditVideoWorkflowSnapshot,
): Promise<void> {
  if (!userId || typeof localStorage === "undefined") return;

  const meta = snapshotToMeta(snapshot);

  try {
    localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch {
    // Quota dépassé (grosse image data URL) — on tente sans assets d'instructions.
    try {
      localStorage.setItem(
        metaKey(userId),
        JSON.stringify({
          ...meta,
          refImageDataUrl: null,
          instructions: meta.instructions.map((row) => ({ ...row, assetDataUrl: null })),
        }),
      );
    } catch {
      return;
    }
  }

  if (snapshot.videoFile) {
    await idbSet(videoBlobKey(userId), snapshot.videoFile);
  } else {
    await idbDelete(videoBlobKey(userId));
  }
}

export async function clearEditVideoWorkflow(userId: string): Promise<void> {
  if (!userId) return;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(metaKey(userId));
    } catch {
      /* ignore */
    }
  }
  await idbDelete(videoBlobKey(userId));
}
