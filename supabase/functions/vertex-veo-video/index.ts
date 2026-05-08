/**
 * Génération vidéo Veo via Vertex AI (remplace l’ancien flux MiniMax/Hailuo pour l’onglet VEO3).
 *
 * Secrets Supabase (au choix) :
 * - Soit GOOGLE_SERVICE_ACCOUNT_JSON : JSON complet du compte de service
 * - Soit variables séparées : GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID (ou GOOGLE_CLOUD_PROJECT_ID)
 * - Sorties vidéo : VERTEX_VIDEO_GCS_URI (ex. gs://bucket/veo/) ou GCS_BUCKET (défaut gs://<bucket>/veo-output/)
 *
 * Optionnels :
 * - VERTEX_AI_LOCATION (défaut: us-central1)
 * - VERTEX_AI_MODEL_ID (défaut: veo-3.0-fast-generate-001)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Aligné sur CAMPAIGN_GENERATION_SPEC_VERSION côté app (campaignGenerationSpec.ts). */
const VERTEX_VEO_REQUEST_SCHEMA_VERSIONS = new Set(["1.0.0"]);

type Action = "create" | "status";

interface RequestBody {
  action: Action;
  task_id?: string;
  prompt?: string;
  model?: string;
  duration?: number;
  aspect_ratio?: string;
  initial_image_url?: string;
  generation_mode?: "text_to_video" | "image_to_video";
  /** Requis pour action create ; versions dans VERTEX_VEO_REQUEST_SCHEMA_VERSIONS. */
  schema_version?: string;
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
}

function normalizePrivateKeyEnv(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  // Souvent stocké sur une ligne avec des \n littéraux
  return t.replace(/\\n/g, "\n");
}

/**
 * JSON service account complet, ou recomposition depuis secrets déjà présents (client_email + private_key + project_id).
 */
function getServiceAccountJson(): string | null {
  const full =
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ||
    Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ||
    Deno.env.get("VERTEX_AI_SERVICE_ACCOUNT_JSON");
  if (full?.trim()) return full.trim();

  const email =
    Deno.env.get("GOOGLE_CLIENT_EMAIL")?.trim() ||
    Deno.env.get("GCP_CLIENT_EMAIL")?.trim();
  const pkRaw =
    Deno.env.get("GOOGLE_PRIVATE_KEY")?.trim() ||
    Deno.env.get("GCP_PRIVATE_KEY")?.trim();
  const projectIdForSa =
    Deno.env.get("GOOGLE_PROJECT_ID")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_PROJECT_ID")?.trim() ||
    Deno.env.get("GCP_PROJECT_ID")?.trim();

  if (email && pkRaw && projectIdForSa) {
    const sa = {
      type: "service_account",
      project_id: projectIdForSa,
      private_key: normalizePrivateKeyEnv(pkRaw),
      client_email: email,
    };
    return JSON.stringify(sa);
  }

  return null;
}

function parseServiceAccount(raw: string): ServiceAccount {
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa?.private_key || !sa?.client_email) {
    throw new Error("JSON compte de service invalide (private_key / client_email).");
  }
  return sa;
}

function pemToPkcs8ArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = "";
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importRsaPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8ArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Signature JWT (segment base64url). */
async function signRs256(data: string, privateKeyPem: string): Promise<string> {
  const key = await importRsaPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  return base64urlEncode(sig);
}

/** Signature GCS V4 (hexadécimal). */
async function signRs256Hex(data: string, privateKeyPem: string): Promise<string> {
  const key = await importRsaPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  };
  const encHeader = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const toSign = `${encHeader}.${encPayload}`;
  const sig = await signRs256(toSign, sa.private_key);
  const jwt = `${toSign}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Échec OAuth Google (token).",
    );
  }
  return data.access_token as string;
}

function parseGsUri(gs: string): { bucket: string; object: string } {
  const s = String(gs || "").trim();
  if (!s.startsWith("gs://")) throw new Error("URI GCS invalide.");
  const rest = s.slice(5);
  const i = rest.indexOf("/");
  if (i <= 0) throw new Error("URI GCS sans chemin objet.");
  return { bucket: rest.slice(0, i), object: rest.slice(i + 1) };
}

/**
 * URL signée v4 (lecture) pour <video src>.
 * Style virtual-hosted comme l’exemple officiel Python (bucket.host + chemin objet seul),
 * pas path-style sur storage.googleapis.com — sinon la signature ne correspond souvent pas.
 */
async function gcsSignedReadUrlV4(
  gcsUri: string,
  sa: ServiceAccount,
  expiresSeconds: number,
): Promise<string> {
  const { bucket, object } = parseGsUri(gcsUri);
  const host = `${bucket}.storage.googleapis.com`;
  const method = "GET";
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStamp =
    now.getUTCFullYear().toString() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate());
  const amzDate =
    dateStamp +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";

  const credentialScope = `${dateStamp}/auto/storage/goog4_request`;
  const credential = `${sa.client_email}/${credentialScope}`;

  const objectPath = object
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const canonicalUri = `/${objectPath}`;

  const qp: [string, string][] = [
    ["X-Goog-Algorithm", "GOOG4-RSA-SHA256"],
    ["X-Goog-Credential", credential],
    ["X-Goog-Date", amzDate],
    ["X-Goog-Expires", String(expiresSeconds)],
    ["X-Goog-SignedHeaders", "host"],
  ];
  qp.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalQueryString = qp
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    "GOOG4-RSA-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signatureHex = await signRs256Hex(stringToSign, sa.private_key);
  const allQuery = `${canonicalQueryString}&x-goog-signature=${signatureHex}`;
  return `https://${host}${canonicalUri}?${allQuery}`;
}

function normalizeGcsOutputPrefix(uri: string): string {
  let u = String(uri || "").trim();
  if (!u.startsWith("gs://")) {
    throw new Error("VERTEX_VIDEO_GCS_URI doit commencer par gs://");
  }
  if (!u.endsWith("/")) u += "/";
  return u;
}

function mapDurationSeconds(requested?: number): number {
  const d = Number(requested);
  if (d <= 4) return 4;
  if (d <= 6) return 6;
  return 8;
}

async function fetchImageAsInlineContent(url: string): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Image initiale inaccessible (${res.status})`);
  }
  const mimeType = String(res.headers.get("content-type") || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  const allowed = new Set(["image/jpeg", "image/png"]);
  if (!allowed.has(mimeType)) {
    throw new Error("Format image non supporté pour Veo image-to-video (attendu: image/jpeg ou image/png).");
  }
  const ab = await res.arrayBuffer();
  const u8 = new Uint8Array(ab);
  let str = "";
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  const b64 = btoa(str);
  return { bytesBase64Encoded: b64, mimeType };
}

/**
 * Parcourt la réponse Vertex (schéma variable selon version API / modèle) pour trouver un gs:// vidéo.
 * Aucune clé en dur : uniquement heuristiques sur les chaînes gs://.
 */
/** Repère gs:// ou URL HTTPS équivalente (réponses Vertex parfois en https). */
function pushGcsCandidates(s: string, out: string[]): void {
  const t = String(s || "").trim();
  if (!t) return;
  if (t.startsWith("gs://")) {
    out.push(t);
    return;
  }
  const noQuery = t.split("?")[0].split("#")[0];

  /** JSON API : https://storage.googleapis.com/download/storage/v1/b/BUCKET/o/OBJECT */
  const mDl = noQuery.match(
    /^https:\/\/storage\.googleapis\.com\/download\/storage\/v1\/b\/([^/]+)\/o\/([^/?]+)/i,
  );
  if (mDl) {
    try {
      const objPath = decodeURIComponent(mDl[2].replace(/\+/g, " "));
      out.push(`gs://${mDl[1]}/${objPath}`);
    } catch {
      out.push(`gs://${mDl[1]}/${mDl[2]}`);
    }
    return;
  }

  const mPath = noQuery.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/i);
  if (mPath) {
    const hostFirst = mPath[1].toLowerCase();
    if (hostFirst !== "download") {
      try {
        const rest = decodeURIComponent(mPath[2].replace(/\+/g, " "));
        out.push(`gs://${mPath[1]}/${rest}`);
      } catch {
        out.push(`gs://${mPath[1]}/${mPath[2]}`);
      }
      return;
    }
  }

  const mVirt = noQuery.match(/^https:\/\/([^.]+)\.storage\.googleapis\.com\/(.+)$/i);
  if (mVirt) {
    try {
      const rest = decodeURIComponent(mVirt[2].replace(/\+/g, " "));
      out.push(`gs://${mVirt[1]}/${rest}`);
    } catch {
      out.push(`gs://${mVirt[1]}/${mVirt[2]}`);
    }
  }
}

function collectGsUris(value: unknown, out: string[], depth = 0): void {
  if (depth > 18) return;
  if (typeof value === "string") {
    pushGcsCandidates(value, out);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectGsUris(v, out, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      collectGsUris((value as Record<string, unknown>)[k], out, depth + 1);
    }
  }
}

function pickBestVideoGcsUri(op: {
  response?: unknown;
  [key: string]: unknown;
}): string {
  const candidates: string[] = [];
  const resp = op.response as Record<string, unknown> | undefined;
  if (resp && Array.isArray(resp.gcsUris)) {
    for (const u of resp.gcsUris) {
      if (typeof u === "string") pushGcsCandidates(u, candidates);
    }
  }
  if (op.response != null) collectGsUris(op.response, candidates);
  if (candidates.length === 0) collectGsUris(op, candidates);

  const uniq = [...new Set(candidates)];
  if (uniq.length === 0) return "";

  const score = (u: string) => {
    let s = 0;
    if (/\.(mp4|webm|mov|mkv)(\?|$)/i.test(u)) s += 10;
    if (/video|veo|output|generated/i.test(u)) s += 4;
    return s;
  };
  uniq.sort((a, b) => score(b) - score(a));
  return uniq[0];
}

/** Complète le message Google quand l’agent Vertex AI n’a pas le droit d’écrire dans le bucket de sortie. */
function withVertexGcsWriteHint(raw: string, outputPrefix: string): string {
  const m = String(raw || "").trim();
  if (!m) return m;
  if (
    /gcp-sa-aiplatform\.iam\.gserviceaccount\.com/i.test(m) &&
    (/storage\.objects\.create/i.test(m) || /Permission.*denied/i.test(m))
  ) {
    return (
      `${m}\n\n` +
      `---\n` +
      `Action GCP : préfixe de sortie « ${outputPrefix} ». ` +
      `Console → Cloud Storage → ouvre ce bucket (même s’il est dans un autre projet que Vertex) → Permissions → Accorder l’accès : ` +
      `principal = le compte service-…@gcp-sa-aiplatform.iam.gserviceaccount.com indiqué dans le message, ` +
      `rôle = Créateur d’objets Storage (roles/storage.objectCreator). ` +
      `Ensuite : sur le même bucket, le compte de service utilisé par l’Edge Function (secret Google) doit pouvoir lire les objets ` +
      `(ex. roles/storage.objectViewer) pour générer l’URL signée. ` +
      `Script local : scripts/grant-vertex-veo-bucket-iam.ps1`
    );
  }
  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token d'authentification manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const saRaw = getServiceAccountJson();
    if (!saRaw) {
      return new Response(
        JSON.stringify({
          error:
            "Configuration Vertex AI manquante : secret GOOGLE_SERVICE_ACCOUNT_JSON, ou bien GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY + GOOGLE_PROJECT_ID (Supabase → Edge Functions → Secrets).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const projectId =
      Deno.env.get("GOOGLE_CLOUD_PROJECT_ID") ||
      Deno.env.get("GCP_PROJECT_ID") ||
      Deno.env.get("GOOGLE_CLOUD_PROJECT") ||
      Deno.env.get("GOOGLE_PROJECT_ID");
    if (!projectId?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "ID projet GCP manquant : GOOGLE_CLOUD_PROJECT_ID ou GOOGLE_PROJECT_ID (secret Supabase).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bucketOnly = Deno.env.get("GCS_BUCKET")?.trim();
    const gcsPrefixRaw =
      Deno.env.get("VERTEX_VIDEO_GCS_URI")?.trim() ||
      Deno.env.get("VERTEX_VEO_OUTPUT_GCS_URI")?.trim() ||
      (bucketOnly ? `gs://${bucketOnly}/veo-output/` : "");
    if (!gcsPrefixRaw?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Préfixe sortie vidéo manquant : VERTEX_VIDEO_GCS_URI (ex. gs://ton-bucket/veo/) ou secret GCS_BUCKET (utilise gs://<bucket>/veo-output/).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let vertexStoragePrefixDisplay: string;
    try {
      vertexStoragePrefixDisplay = normalizeGcsOutputPrefix(gcsPrefixRaw);
    } catch {
      vertexStoragePrefixDisplay = gcsPrefixRaw;
    }

    const location = (Deno.env.get("VERTEX_AI_LOCATION") || "us-central1").trim();
    const defaultModel = (Deno.env.get("VERTEX_AI_MODEL_ID") ||
      "veo-3.1-fast-generate-001").trim();

    const sa = parseServiceAccount(saRaw);
    const accessToken = await getGoogleAccessToken(sa);

    const body: RequestBody = await req.json();
    const action = body.action;
    if (action !== "create" && action !== "status") {
      return new Response(
        JSON.stringify({ error: "Action invalide. Utilisez create ou status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create") {
      const schemaVersion = String(body.schema_version ?? "").trim();
      if (!schemaVersion) {
        return new Response(
          JSON.stringify({
            error:
              "Le champ schema_version est requis pour créer une vidéo. Indique la version du contrat d’API (ex. 1.0.0).",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!VERTEX_VEO_REQUEST_SCHEMA_VERSIONS.has(schemaVersion)) {
        const accepted = [...VERTEX_VEO_REQUEST_SCHEMA_VERSIONS].join(", ");
        return new Response(
          JSON.stringify({
            error: `schema_version non reconnue : « ${schemaVersion} ». Versions acceptées : ${accepted}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const modelId = String(body.model || defaultModel).trim() || defaultModel;
    const baseUrl =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`;

    if (action === "create") {
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "Le prompt est requis." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const storageUri = normalizeGcsOutputPrefix(gcsPrefixRaw);
      const durationSeconds = mapDurationSeconds(body.duration);
      const aspectRatio =
        body.aspect_ratio === "9:16" || body.aspect_ratio === "16:9"
          ? body.aspect_ratio
          : "16:9";
      const initialImageUrl = String(body.initial_image_url || "").trim();
      const generationMode: "text_to_video" | "image_to_video" =
        body.generation_mode === "image_to_video" ? "image_to_video" : "text_to_video";
      if (generationMode === "image_to_video" && !initialImageUrl) {
        return new Response(
          JSON.stringify({ error: "Mode image_to_video requis mais image initiale absente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const instance: Record<string, unknown> = {
        prompt: generationMode === "image_to_video"
          ? `${prompt.slice(0, 7600)}\nThe first frame must exactly match the provided input image.`
          : prompt.slice(0, 8000),
      };
      if (generationMode === "image_to_video" && initialImageUrl) {
        // Mode explicite image-to-video: image inline pour imposer un vrai état initial.
        const inlineImage = await fetchImageAsInlineContent(initialImageUrl);
        instance.image = inlineImage;
      }
      const predictBody = {
        instances: [instance],
        parameters: {
          storageUri,
          sampleCount: 1,
          aspectRatio,
          durationSeconds,
          ...(generationMode === "image_to_video" ? { resizeMode: "crop" } : {}),
        },
      };

      let createRes = await fetch(`${baseUrl}:predictLongRunning`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(predictBody),
      });

      let createText = await createRes.text();
      let createData: { name?: string; error?: { message?: string } } = {};
      try {
        createData = JSON.parse(createText);
      } catch {
        /* ignore */
      }

      if (!createRes.ok && generationMode === "image_to_video") {
        const rawErr = String(createData?.error?.message || createText || "");
        const hinted =
          `${rawErr}\n\n` +
          "Le mode image-to-video a échoué. Vérifie que le modèle Vertex configuré supporte bien l'entrée image comme première frame.";
        return new Response(
          JSON.stringify({ error: hinted }),
          { status: createRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!createRes.ok) {
        const rawErr =
          createData?.error?.message ||
          createText ||
          `Erreur Vertex (${createRes.status})`;
        return new Response(
          JSON.stringify({
            error: withVertexGcsWriteHint(rawErr, vertexStoragePrefixDisplay),
          }),
          { status: createRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const opName = String(createData?.name || "").trim();
      if (!opName) {
        return new Response(
          JSON.stringify({ error: "Vertex n'a pas retourné d'opération (name)." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          task_id: opName,
          status: "processing",
          model: modelId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const operationName = String(body.task_id || "").trim();
    if (!operationName) {
      return new Response(
        JSON.stringify({ error: "task_id requis pour action status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fetchRes = await fetch(`${baseUrl}:fetchPredictOperation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName }),
    });

    const fetchText = await fetchRes.text();
    let op: {
      done?: boolean;
      error?: { code?: number; message?: string };
      response?: {
        videos?: Array<{ gcsUri?: string; mimeType?: string }>;
        "@type"?: string;
      };
    } = {};
    try {
      op = JSON.parse(fetchText);
    } catch {
      /* ignore */
    }

    if (!fetchRes.ok) {
      const rawErr = op?.error?.message || fetchText || `Erreur Vertex (${fetchRes.status})`;
      return new Response(
        JSON.stringify({
          error: withVertexGcsWriteHint(rawErr, vertexStoragePrefixDisplay),
        }),
        { status: fetchRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!op.done) {
      return new Response(
        JSON.stringify({
          task_id: operationName,
          status: "processing",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (op.error && (op.error.message || op.error.code != null)) {
      const rawErr = op.error.message || `Vertex (code ${op.error.code ?? "?"})`;
      return new Response(
        JSON.stringify({
          task_id: operationName,
          status: "failed",
          error: withVertexGcsWriteHint(rawErr, vertexStoragePrefixDisplay),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const gcsUri = pickBestVideoGcsUri(op as { response?: unknown; [key: string]: unknown });
    if (!gcsUri) {
      console.error(
        "vertex-veo-video: op terminée sans gs:// détectable. Extrait brut (tronqué):",
        fetchText.slice(0, 2000),
      );
      return new Response(
        JSON.stringify({
          task_id: operationName,
          status: "failed",
          error:
            "Réponse Vertex sans URI GCS vidéo reconnaissable. Vérifie le modèle (VERTEX_AI_MODEL_ID) et les logs de la fonction.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let videoUrl: string;
    try {
      videoUrl = await gcsSignedReadUrlV4(gcsUri, sa, 3600);
    } catch (signErr) {
      console.error("Signature URL GCS:", signErr);
      return new Response(
        JSON.stringify({
          task_id: operationName,
          status: "failed",
          error:
            "Vidéo générée mais impossible de signer l'URL GCS. Vérifie la clé du compte de service et le rôle « Lecteur d’objets Storage » (ou équivalent) sur le bucket de sortie pour l’e-mail du compte utilisé par cette fonction.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        task_id: operationName,
        status: "success",
        video_url: videoUrl,
        gcs_uri: gcsUri,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erreur Edge Function vertex-veo-video:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur serveur",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
