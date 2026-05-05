const LS_VIRALWORKS_MEDIA_CACHE_KEY = "viralworks_media_cache";
const IDB_DB_NAME = "viralworks_media_cache_db";
const IDB_DB_VERSION = 1;
const IDB_STORE_MEDIA = "media";
const MAX_LOCALSTORAGE_PAYLOAD_BYTES = 700_000;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function estimateSizeBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function isProbablySignedUrl(url) {
  if (typeof url !== "string") return false;
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const parsed = new URL(s);
    const signedParams = [
      "Expires",
      "X-Goog-Algorithm",
      "X-Goog-Credential",
      "X-Goog-Date",
      "X-Goog-Expires",
      "X-Goog-Signature",
      "X-Amz-Algorithm",
      "X-Amz-Credential",
      "X-Amz-Date",
      "X-Amz-Expires",
      "X-Amz-Signature",
      "token",
      "signature",
      "sig",
    ];
    return signedParams.some((k) => parsed.searchParams.has(k));
  } catch {
    return true;
  }
}

function normalizeMediaIndex(raw) {
  const base = {
    version: 1,
    updatedAt: nowIso(),
    images: [],
    videos: [],
  };
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    images: Array.isArray(raw.images) ? raw.images : [],
    videos: Array.isArray(raw.videos) ? raw.videos : [],
  };
}

function readMediaIndex() {
  if (typeof localStorage === "undefined") return normalizeMediaIndex(null);
  const parsed = safeJsonParse(localStorage.getItem(LS_VIRALWORKS_MEDIA_CACHE_KEY), null);
  return normalizeMediaIndex(parsed);
}

function writeMediaIndex(next) {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(LS_VIRALWORKS_MEDIA_CACHE_KEY, JSON.stringify(normalizeMediaIndex(next)));
    return true;
  } catch {
    return false;
  }
}

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_MEDIA)) {
          db.createObjectStore(IDB_STORE_MEDIA);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_MEDIA, "readwrite");
      tx.objectStore(IDB_STORE_MEDIA).put(value, key);
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

async function idbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_MEDIA, "readonly");
      const req = tx.objectStore(IDB_STORE_MEDIA).get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
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

async function idbDeleteDatabase() {
  if (typeof indexedDB === "undefined") return;
  await new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(IDB_DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function loadViralWorksMediaCacheIndex() {
  return readMediaIndex();
}

export async function saveImageMediaRef(payload) {
  const urls = Array.isArray(payload?.urls)
    ? payload.urls
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter((u) => u && !u.startsWith("blob:") && !isProbablySignedUrl(u))
    : [];

  const fallbackCandidates = Array.isArray(payload?.fallbackData)
    ? payload.fallbackData.filter((v) => typeof v === "string" && v.trim().length > 0)
    : [];

  let storageMode = "refs";
  let fallbackStored = false;
  const fallbackSize = estimateSizeBytes(fallbackCandidates);

  if (fallbackCandidates.length > 0) {
    if (fallbackSize <= MAX_LOCALSTORAGE_PAYLOAD_BYTES) {
      storageMode = "localStorage";
    } else {
      const idbOk = await idbSet("image_fallback_payload", fallbackCandidates);
      if (idbOk) {
        storageMode = "indexeddb";
        fallbackStored = true;
      }
    }
  }

  const index = readMediaIndex();
  const next = {
    ...index,
    updatedAt: nowIso(),
    images: [
      {
        mediaId:
          payload?.mediaId ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `img-${Date.now()}`),
        createdAt: payload?.createdAt || nowIso(),
        updatedAt: nowIso(),
        urls,
        fileIds: Array.isArray(payload?.fileIds) ? payload.fileIds : [],
        storageMode,
        fallbackData:
          storageMode === "localStorage" ? fallbackCandidates : [],
      },
    ],
  };
  writeMediaIndex(next);
  return {
    ok: true,
    storageMode,
    fallbackStored,
  };
}

export async function loadImageMediaRefs() {
  const index = readMediaIndex();
  const entry = Array.isArray(index.images) ? index.images[0] : null;
  if (!entry) return null;
  let fallbackData = Array.isArray(entry.fallbackData) ? entry.fallbackData : [];
  if ((!fallbackData || fallbackData.length === 0) && entry.storageMode === "indexeddb") {
    const idbPayload = await idbGet("image_fallback_payload");
    if (Array.isArray(idbPayload)) fallbackData = idbPayload;
  }
  return {
    ...entry,
    urls: Array.isArray(entry.urls) ? entry.urls : [],
    fallbackData: Array.isArray(fallbackData) ? fallbackData : [],
  };
}

export function saveVideoMediaRef(payload) {
  const videoId = typeof payload?.videoId === "string" ? payload.videoId.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : "veo3";
  if (!videoId || isProbablySignedUrl(videoId) || videoId.startsWith("blob:")) {
    return { ok: false };
  }
  const index = readMediaIndex();
  const next = {
    ...index,
    updatedAt: nowIso(),
    videos: [
      {
        mediaId:
          payload?.mediaId ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `vid-${Date.now()}`),
        createdAt: payload?.createdAt || nowIso(),
        updatedAt: nowIso(),
        videoId,
        provider,
        status: payload?.status || "done",
      },
    ],
  };
  writeMediaIndex(next);
  return { ok: true };
}

export function loadVideoMediaRefs() {
  const index = readMediaIndex();
  const entry = Array.isArray(index.videos) ? index.videos[0] : null;
  if (!entry) return null;
  return entry;
}

export async function purgeViralWorksMediaCache() {
  try {
    localStorage.removeItem(LS_VIRALWORKS_MEDIA_CACHE_KEY);
  } catch {
    /* ignore */
  }
  await idbDeleteDatabase();
}

