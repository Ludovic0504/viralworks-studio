const fs = require("node:fs");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

async function head(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return { status: res.status, ct: res.headers.get("content-type") || "" };
  } catch (err) {
    return { status: 0, ct: "", err: String(err) };
  }
}

async function main() {
  const env = { ...readEnvFile(".env.local"), ...readEnvFile(".env") };
  const base = String(env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) {
    console.error("Missing VITE_SUPABASE_URL in .env.local");
    process.exit(2);
  }

  const buckets = [
    "generated-videos",
    "videos",
    "assets",
    "public",
    "ressources",
    "resources",
    "demo",
    "demos",
    "media",
  ];

  const files = [
    "Video_Chantier_Architect_Veo3_4.mov",
    "Assaemblage progressif - Moteur (1) copie.mp4",
    "Yacht Pub 2(2).mp4",
    "chantier.mp4",
    "moteur.mp4",
    "yacht.mp4",
    "chantier.webm",
    "moteur.webm",
    "yacht.webm",
  ];

  const hits = [];
  for (const bucket of buckets) {
    for (const file of files) {
      const url = `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(file)}`;
      // eslint-disable-next-line no-await-in-loop
      const h = await head(url);
      if (h.status && h.status < 400) {
        hits.push({ bucket, file, status: h.status, ct: h.ct, url });
        console.log(`HIT ${bucket}/${file} -> ${h.status} ${h.ct}`);
      }
    }
  }

  if (hits.length === 0) {
    console.log("NO_HITS");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

