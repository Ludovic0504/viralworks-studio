/**
 * Persistance checkpoints pipeline 24s : Supabase + sessionStorage fallback.
 */
import { getBrowserSupabase } from "./supabase/client-navigateur";

const LS_PREFIX = "vws_video24_checkpoint:";

export type SegmentStatus = "pending" | "processing" | "succeeded" | "failed";

export type SegmentCheckpoint = {
  status: SegmentStatus;
  task_id?: string;
  model?: string;
  video_url?: string;
  gcs_uri?: string;
  error?: string;
};

export type SegmentsCheckpoint = {
  "0"?: SegmentCheckpoint;
  "1"?: SegmentCheckpoint;
  "2"?: SegmentCheckpoint;
};

export type VideoPipeline24Checkpoint = {
  prompt_hash: string;
  prompts: { p1: string; p2: string; p3: string };
  pipeline_step: number;
  segments: SegmentsCheckpoint;
  frame_hook_after_seg1_url: string | null;
  frame_hook_after_seg2_url: string | null;
  updated_at?: string;
};

function normalizePrompts(p1: string, p2: string, p3: string): { p1: string; p2: string; p3: string } {
  return {
    p1: String(p1 ?? ""),
    p2: String(p2 ?? ""),
    p3: String(p3 ?? ""),
  };
}

/** SHA-256 hex des trois prompts (JSON UTF-8 stable). */
export async function hashThreePrompts(p1: string, p2: string, p3: string): Promise<string> {
  const payload = JSON.stringify(normalizePrompts(p1, p2, p3));
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function lsKey(promptHash: string): string {
  return `${LS_PREFIX}${promptHash}`;
}

function checkpointStorage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

/** Supprime tous les checkpoints locaux (localStorage legacy + session). */
export function clearAllVideo24CheckpointsLocal(): void {
  for (const store of [localStorage, sessionStorage] as const) {
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(LS_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

function parseCheckpoint(raw: unknown): VideoPipeline24Checkpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ph = String(o.prompt_hash ?? "").trim();
  const prompts = o.prompts as Record<string, unknown> | undefined;
  if (!ph || !prompts) return null;
  const p1 = String(prompts.p1 ?? "");
  const p2 = String(prompts.p2 ?? "");
  const p3 = String(prompts.p3 ?? "");
  const step = Number(o.pipeline_step);
  if (!Number.isFinite(step) || step < 1 || step > 6) return null;
  return {
    prompt_hash: ph,
    prompts: { p1, p2, p3 },
    pipeline_step: Math.floor(step),
    segments: (o.segments as SegmentsCheckpoint) || {},
    frame_hook_after_seg1_url: o.frame_hook_after_seg1_url != null ? String(o.frame_hook_after_seg1_url) : null,
    frame_hook_after_seg2_url: o.frame_hook_after_seg2_url != null ? String(o.frame_hook_after_seg2_url) : null,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined,
  };
}

function mergeSegments(a: SegmentsCheckpoint, b: SegmentsCheckpoint): SegmentsCheckpoint {
  const out: SegmentsCheckpoint = { ...a };
  for (const k of ["0", "1", "2"] as const) {
    const prev = a[k];
    const next = b[k];
    if (!next) continue;
    if (!prev) {
      out[k] = next;
      continue;
    }
    if (prev.status === "succeeded" && next.status !== "succeeded" && next.status !== "failed") {
      out[k] = prev;
      continue;
    }
    out[k] = { ...prev, ...next };
  }
  return out;
}

export async function loadCheckpoint(promptHash: string): Promise<VideoPipeline24Checkpoint | null> {
  const supabase = getBrowserSupabase();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { data, error } = await supabase
        .from("video_pipeline_24_checkpoints")
        .select(
          "prompt_hash, prompts, pipeline_step, segments, frame_hook_after_seg1_url, frame_hook_after_seg2_url, updated_at",
        )
        .eq("user_id", session.user.id)
        .eq("prompt_hash", promptHash)
        .maybeSingle();
      if (!error && data) {
        const c = parseCheckpoint({
          ...data,
          prompts:
            typeof data.prompts === "object" && data.prompts !== null
              ? data.prompts
              : { p1: "", p2: "", p3: "" },
        });
        if (c) return c;
      }
    }
  } catch {
    /* fallback local */
  }

  try {
    const store = checkpointStorage();
    const raw = store?.getItem(lsKey(promptHash));
    if (!raw) {
      const legacy = localStorage.getItem(lsKey(promptHash));
      if (!legacy) return null;
      return parseCheckpoint(JSON.parse(legacy));
    }
    return parseCheckpoint(JSON.parse(raw));
  } catch {
    return null;
  }
}

export type UpsertCheckpointInput = Partial<Omit<VideoPipeline24Checkpoint, "prompt_hash" | "prompts">> & {
  prompt_hash: string;
  prompts?: { p1: string; p2: string; p3: string };
};

export async function upsertCheckpoint(input: UpsertCheckpointInput): Promise<void> {
  const prompt_hash = String(input.prompt_hash || "").trim();
  if (!prompt_hash) return;

  const existing = await loadCheckpoint(prompt_hash);
  const prompts =
    input.prompts ??
    existing?.prompts ??
    ({ p1: "", p2: "", p3: "" } as VideoPipeline24Checkpoint["prompts"]);

  const merged: VideoPipeline24Checkpoint = {
    prompt_hash,
    prompts: normalizePrompts(prompts.p1, prompts.p2, prompts.p3),
    pipeline_step: input.pipeline_step ?? existing?.pipeline_step ?? 1,
    segments: mergeSegments(existing?.segments ?? {}, input.segments ?? {}),
    frame_hook_after_seg1_url:
      input.frame_hook_after_seg1_url !== undefined
        ? input.frame_hook_after_seg1_url
        : existing?.frame_hook_after_seg1_url ?? null,
    frame_hook_after_seg2_url:
      input.frame_hook_after_seg2_url !== undefined
        ? input.frame_hook_after_seg2_url
        : existing?.frame_hook_after_seg2_url ?? null,
    updated_at: new Date().toISOString(),
  };

  const row = {
    prompt_hash,
    prompts: merged.prompts,
    pipeline_step: merged.pipeline_step,
    segments: merged.segments,
    frame_hook_after_seg1_url: merged.frame_hook_after_seg1_url,
    frame_hook_after_seg2_url: merged.frame_hook_after_seg2_url,
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { error } = await supabase.from("video_pipeline_24_checkpoints").upsert(
        {
          user_id: session.user.id,
          ...row,
        },
        { onConflict: "user_id,prompt_hash" },
      );
      if (!error) {
        try {
          checkpointStorage()?.setItem(lsKey(prompt_hash), JSON.stringify(merged));
          localStorage.removeItem(lsKey(prompt_hash));
        } catch {
          /* ignore */
        }
        return;
      }
    }
  } catch {
    /* local only */
  }

  try {
    checkpointStorage()?.setItem(lsKey(prompt_hash), JSON.stringify(merged));
    localStorage.removeItem(lsKey(prompt_hash));
  } catch {
    /* ignore */
  }
}

export async function clearCheckpoint(promptHash: string): Promise<void> {
  const ph = String(promptHash || "").trim();
  if (!ph) return;

  try {
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("video_pipeline_24_checkpoints").delete().eq("user_id", session.user.id).eq("prompt_hash", ph);
    }
  } catch {
    /* ignore */
  }

  try {
    checkpointStorage()?.removeItem(lsKey(ph));
    localStorage.removeItem(lsKey(ph));
  } catch {
    /* ignore */
  }
}

/** Tout checkpoint non supprimé est considéré reprenable (le succès final appelle `clearCheckpoint`). */
export function isCheckpointResumable(c: VideoPipeline24Checkpoint | null): boolean {
  return c != null;
}
