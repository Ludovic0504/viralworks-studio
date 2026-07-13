/**
 * Supprime les pistes audio des vidéos de démo :
 * - public/videos/*.mp4 (fallback local)
 * - bucket Supabase demo-videos (prod / .env)
 *
 * Usage: node scripts/strip-demo-video-audio.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const videosDir = path.join(rootDir, "public/videos");
const workDir = path.join(rootDir, ".tmp/demo-videos-noaudio");
const PROJECT_REF = "wuvtfhletxieocetzppo";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const LOCAL_FILES = ["chantier.mp4", "moteur.mp4", "yacht.mp4"];

const REMOTE_DEMOS = [
  {
    url: `${SUPABASE_URL}/storage/v1/object/public/demo-videos/Artisan.mp4`,
    bucketPath: "Artisan.mp4",
  },
  {
    url: `${SUPABASE_URL}/storage/v1/object/public/demo-videos/HightTech_Essai_4.mp4`,
    bucketPath: "HightTech_Essai_4.mp4",
  },
  {
    url: `${SUPABASE_URL}/storage/v1/object/public/demo-videos/Cosmetic_Essai_2.mp4`,
    bucketPath: "Cosmetic_Essai_2.mp4",
  },
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function resolveFfmpegBinary() {
  const fromPath = spawnSync("ffmpeg", ["-version"], { encoding: "utf8", shell: true });
  if (fromPath.status === 0) return "ffmpeg";

  if (process.platform === "win32") {
    const wingetRoot = path.join(process.env.LOCALAPPDATA || "", "Microsoft/WinGet/Packages");
    if (fs.existsSync(wingetRoot)) {
      for (const entry of fs.readdirSync(wingetRoot)) {
        if (!entry.toLowerCase().includes("ffmpeg")) continue;
        const packageDir = path.join(wingetRoot, entry);
        const builds = fs
          .readdirSync(packageDir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && d.name.startsWith("ffmpeg-"));
        for (const build of builds) {
          const candidate = path.join(packageDir, build.name, "bin/ffmpeg.exe");
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }
  }

  return null;
}

function resolveFfprobeBinary(ffmpegBinary) {
  if (ffmpegBinary === "ffmpeg") return "ffprobe";
  return ffmpegBinary.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
}

function run(bin, args, options = {}) {
  return spawnSync(bin, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

function hasAudioTrack(ffprobeBinary, inputPath) {
  const probe = run(ffprobeBinary, [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "csv=p=0",
    inputPath,
  ]);
  return Boolean(probe.stdout?.trim());
}

function stripAudio(ffmpegBinary, inputPath, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = run(ffmpegBinary, [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-c:v",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `ffmpeg failed for ${inputPath}`);
  }
}

function replaceFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (path.resolve(src) === path.resolve(dest)) return;
  fs.copyFileSync(src, dest);
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed ${url} -> HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
}

function resolveServiceRoleKey() {
  const env = {
    ...readEnvFile(path.join(rootDir, ".env")),
    ...readEnvFile(path.join(rootDir, ".env.local")),
    ...process.env,
  };

  const fromEnv = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (fromEnv) return fromEnv;

  const result = run("supabase", [
    "projects",
    "api-keys",
    "--project-ref",
    PROJECT_REF,
    "-o",
    "json",
  ]);
  if (result.status !== 0) {
    throw new Error("Impossible de récupérer la clé service_role Supabase (supabase login requis).");
  }

  const keys = JSON.parse(result.stdout);
  const service = keys.find((entry) => entry.name === "service_role");
  if (!service?.api_key) {
    throw new Error("Clé service_role introuvable dans la sortie Supabase CLI.");
  }
  return service.api_key;
}

function createSupabaseAdmin() {
  const serviceRoleKey = resolveServiceRoleKey();
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function uploadToSupabase(supabase, localPath, bucketPath) {
  const body = fs.readFileSync(localPath);
  const { error: removeError } = await supabase.storage.from("demo-videos").remove([bucketPath]);
  if (removeError) {
    throw new Error(`remove failed for ${bucketPath}: ${removeError.message}`);
  }

  const { error } = await supabase.storage.from("demo-videos").upload(bucketPath, body, {
    upsert: true,
    contentType: "video/mp4",
    cacheControl: "31536000",
  });
  if (error) {
    throw new Error(`upload failed for ${bucketPath}: ${error.message}`);
  }
}

function loadDemoUrlsFromEnv() {
  const env = {
    ...readEnvFile(path.join(rootDir, ".env")),
    ...readEnvFile(path.join(rootDir, ".env.local")),
  };
  const urls = [
    env.VITE_DEMO_VIDEO_CHANTIER_URL,
    env.VITE_DEMO_VIDEO_MOTEUR_URL,
    env.VITE_DEMO_VIDEO_YACHT_URL,
  ].filter(Boolean);

  if (urls.length === 0) return REMOTE_DEMOS;

  return urls.map((url) => {
    const bucketPath = decodeURIComponent(url.split("/").pop() || "");
    return { url, bucketPath };
  });
}

async function processLocalFiles(ffmpegBinary, ffprobeBinary) {
  console.log("\n== Fichiers locaux (public/videos) ==");
  for (const fileName of LOCAL_FILES) {
    const input = path.join(videosDir, fileName);
    if (!fs.existsSync(input)) {
      console.warn(`skip: ${fileName} (introuvable)`);
      continue;
    }

    if (!hasAudioTrack(ffprobeBinary, input)) {
      console.log(`ok: ${fileName} (déjà sans audio)`);
      continue;
    }

    const tmp = path.join(workDir, `local-${fileName}`);
    stripAudio(ffmpegBinary, input, tmp);
    replaceFile(tmp, input);
    console.log(`ok: ${fileName} (audio supprimé)`);
  }
}

async function processRemoteDemos(ffmpegBinary, ffprobeBinary, supabase) {
  console.log("\n== Vidéos Supabase (demo-videos) ==");
  const demos = loadDemoUrlsFromEnv();

  for (const demo of demos) {
    const { url, bucketPath } = demo;
    const downloaded = path.join(workDir, "remote-src", bucketPath);
    const stripped = path.join(workDir, "remote-out", bucketPath);

    console.log(`→ ${bucketPath}`);
    await downloadFile(url, downloaded);

    if (!hasAudioTrack(ffprobeBinary, downloaded)) {
      console.log("  déjà sans audio, upload ignoré");
      continue;
    }

    stripAudio(ffmpegBinary, downloaded, stripped);
    await uploadToSupabase(supabase, stripped, bucketPath);
    console.log("  audio supprimé + réuploadé sur Supabase");
  }
}

async function main() {
  const ffmpegBinary = resolveFfmpegBinary();
  if (!ffmpegBinary) {
    console.error("ffmpeg introuvable. Installe-le (ex. winget install Gyan.FFmpeg) puis relance.");
    process.exit(1);
  }

  const ffprobeBinary = resolveFfprobeBinary(ffmpegBinary);
  const supabase = createSupabaseAdmin();
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`ffmpeg: ${ffmpegBinary}`);
  await processLocalFiles(ffmpegBinary, ffprobeBinary);
  await processRemoteDemos(ffmpegBinary, ffprobeBinary, supabase);
  console.log("\nTerminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
