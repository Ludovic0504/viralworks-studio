/**
 * Upload récursif de dist/ vers l'hébergement OVH (FTP), y compris .htaccess.
 *
 * Prérequis : npm run build
 *
 * Mot de passe (ne pas committer) — une des options :
 *   - variable d'environnement FTP_PASSWORD
 *   - clé FTP_PASSWORD dans .env.local à la racine du projet
 *
 * Usage (depuis la racine du projet) :
 *   npm run deploy:ovh-ftp
 *
 * Surcharges optionnelles :
 *   FTP_HOST, FTP_USER, FTP_PORT, FTP_REMOTE_DIR, FTP_LOCAL_DIR
 *   FTP_LIST_ONLY=1        — cd vers FTP_REMOTE_DIR puis liste son contenu (sans upload)
 *   FTP_REMOTE_DIR=.       — upload dans le répertoire courant après login (souvent la racine web OVH)
 *   FTP_PASSIVE=0          — forcer le mode actif (PORT) ; défaut = passif (PASV)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "basic-ftp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const DEFAULTS = {
  host: "ftp.cluster100.hosting.ovh.net",
  user: "rbaqzyl",
  port: 21,
  remoteDir: "www",
  localDir: "dist",
};

/** Fichiers à ne pas envoyer sur OVH (spécifiques à d'autres hébergeurs). */
const FTP_IGNORE_FILENAMES = new Set(["_redirects"]);

const HTACCESS_BASENAME = ".htaccess";

function isHtaccessEntry(entry) {
  return path.posix.basename(entry.rel) === HTACCESS_BASENAME;
}

/** .htaccess en dernier : OVH mutualisé l'accepte parfois une fois le dossier rempli. */
function sortEntriesForUpload(entries) {
  return [...entries].sort((a, b) => {
    const aLast = isHtaccessEntry(a) ? 1 : 0;
    const bLast = isHtaccessEntry(b) ? 1 : 0;
    return aLast - bLast || a.rel.localeCompare(b.rel);
  });
}

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
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function env(name, fallback = "") {
  return String(process.env[name] ?? "").trim() || fallback;
}

function posixJoin(...parts) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

/** @returns {Promise<{ localPath: string, rel: string }[]>} */
async function listFilesRecursive(localRoot) {
  const files = [];

  async function walk(current) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(localPath);
      } else if (entry.isFile()) {
        if (FTP_IGNORE_FILENAMES.has(entry.name)) continue;
        const rel = path.relative(localRoot, localPath).split(path.sep).join("/");
        files.push({ localPath, rel });
      }
    }
  }

  await walk(localRoot);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {string} label
 * @param {string} [dirPath]
 */
async function printRemoteListing(client, label, dirPath) {
  const where = dirPath ?? ".";
  console.log(`\n── ${label} ──`);
  console.log(`   Chemin listé : ${where}`);

  let listing;
  try {
    listing = await client.list(where);
  } catch (err) {
    console.log(`   (impossible de lister : ${err?.message ?? err})`);
    return { listing: [], ok: false };
  }

  const dirs = listing.filter((e) => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
  const files = listing.filter((e) => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name));

  if (dirs.length) {
    console.log("   Dossiers :");
    for (const d of dirs) {
      console.log(`     [DIR]  ${d.name}`);
    }
  }
  if (files.length) {
    console.log("   Fichiers :");
    for (const f of files) {
      const size = f.size != null ? ` (${f.size} o)` : "";
      console.log(`     [FILE] ${f.name}${size}`);
    }
  }
  if (!dirs.length && !files.length) {
    console.log("   (vide)");
  }

  return { listing, ok: true, dirs };
}

/**
 * Chemins relatifs de tous les dossiers parents à créer (triés par profondeur).
 * @param {{ rel: string }[]} entries
 */
function collectRemoteSubdirs(entries) {
  const dirs = new Set();
  for (const { rel } of entries) {
    const parent = path.posix.dirname(rel);
    if (!parent || parent === ".") continue;
    const segments = parent.split("/").filter(Boolean);
    for (let i = 1; i <= segments.length; i++) {
      dirs.add(segments.slice(0, i).join("/"));
    }
  }
  return [...dirs].sort((a, b) => {
    const depth = (p) => p.split("/").length;
    return depth(a) - depth(b) || a.localeCompare(b);
  });
}

/**
 * Crée chaque sous-dossier (parents puis enfants) depuis le répertoire courant du client FTP.
 * @param {import("basic-ftp").Client} client
 * @param {string[]} relativeDirs
 */
function applyFtpTransferMode(client) {
  const passive = env("FTP_PASSIVE") !== "0";
  client.ftp.passive = passive;
  return passive;
}

function ftpTransferModeLabel(client) {
  return client.ftp.passive !== false ? "passif (PASV)" : "actif (PORT)";
}

/**
 * Contexte d'upload : chemins distants = structure de dist/ (entry.rel), pas le pwd courant.
 * @param {string} uploadBasePwd pwd FTP après cd vers la racine de déploiement (ex. …/www)
 */
function createUploadContext(uploadBasePwd) {
  const base = uploadBasePwd.replace(/\\/g, "/").replace(/\/$/, "");
  return {
    uploadBasePwd: base,
    /** Chemin distant relatif à la racine de déploiement (= racine dist/). */
    remotePath(rel) {
      return rel.split(path.sep).join("/");
    },
    remoteFullPath(rel) {
      return posixJoin(base, rel.split(path.sep).join("/"));
    },
  };
}

/** @param {import("basic-ftp").Client} client @param {ReturnType<typeof createUploadContext>} ctx */
async function cdUploadBase(client, ctx) {
  await client.cd(ctx.uploadBasePwd);
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {ReturnType<typeof createUploadContext>} ctx
 * @param {{ localPath: string, rel: string }} entry
 */
async function logUploadAttempt(client, entry, ctx) {
  const remote = ctx.remotePath(entry.rel);
  const cwd = await client.pwd();
  console.log("  → upload tentative");
  console.log(`     transfert : ${ftpTransferModeLabel(client)}`);
  console.log(`     local     : ${entry.localPath}`);
  console.log(`     distant   : ${remote} (relatif à dist/, pas au pwd)`);
  console.log(`     base FTP  : ${ctx.uploadBasePwd}`);
  console.log(`     pwd actuel: ${cwd}`);
  console.log(`     chemin    : ${ctx.remoteFullPath(entry.rel)}`);
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {ReturnType<typeof createUploadContext>} ctx
 * @param {string[]} relativeDirs chemins relatifs à dist/
 */
async function ensureRemoteDirsRecursive(client, ctx, relativeDirs) {
  for (const dir of relativeDirs) {
    const remote = ctx.remotePath(dir);
    await cdUploadBase(client, ctx);
    console.log(
      `  → mkdir distant : ${remote} (base=${ctx.uploadBasePwd}, ${ftpTransferModeLabel(client)})`
    );
    await client.ensureDir(remote);
    await cdUploadBase(client, ctx);
  }
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {ReturnType<typeof createUploadContext>} ctx
 */
async function removeObsoleteRemoteDir(client, ctx, relativeDir) {
  const remote = ctx.remotePath(relativeDir);
  await cdUploadBase(client, ctx);
  try {
    await client.removeDir(remote);
    console.log(`  [removeDir] ${remote} (dossier obsolète supprimé sur le serveur)`);
  } catch (err) {
    console.log(`  [removeDir] ${remote} — ignoré (${err?.message ?? err})`);
  }
  await cdUploadBase(client, ctx);
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {ReturnType<typeof createUploadContext>} ctx
 */
async function removeObsoleteRemoteFiles(client, ctx) {
  const obsoleteFiles = ["registerSW.js"];
  await cdUploadBase(client, ctx);
  for (const rel of obsoleteFiles) {
    try {
      await client.remove(rel);
      console.log(`  [remove] ${rel} (fichier obsolète supprimé sur le serveur)`);
    } catch {
      // absent ou déjà supprimé — ignorer
    }
  }

  // Ancien emplacement des assets Image Studio — collisionnait avec la route SPA /image-studio.
  await removeObsoleteRemoteDir(client, ctx, "image-studio");

  await cdUploadBase(client, ctx);
}

/**
 * @param {import("basic-ftp").Client} client
 * @param {ReturnType<typeof createUploadContext>} ctx
 * @param {{ localPath: string, rel: string }} entry
 */
async function uploadOneEntry(client, ctx, entry) {
  const remote = ctx.remotePath(entry.rel);
  const parent = path.posix.dirname(remote);
  if (parent && parent !== ".") {
    await cdUploadBase(client, ctx);
    console.log(`  → ensureDir parent : ${parent} (avant ${remote})`);
    await client.ensureDir(parent);
    await cdUploadBase(client, ctx);
  }
  await cdUploadBase(client, ctx);
  await logUploadAttempt(client, entry, ctx);
  await client.uploadFrom(entry.localPath, remote);
}

function printHtaccessManualFallback(localPath, rel, err) {
  const content = fs.readFileSync(localPath, "utf8");
  console.error(`\nÉchec upload de ${rel} : ${err?.message ?? err}`);
  console.log(
    "\n── Contenu .htaccess à recréer manuellement (gestionnaire de fichiers OVH) ──\n"
  );
  console.log(content);
  console.log("── Fin du contenu .htaccess ──\n");
  console.log(
    "OVH mutualisé bloque souvent les fichiers commençant par « . » via FTP.\n" +
      "Dans l'espace client OVH → Hébergement → Multisite → Gestionnaire de fichiers,\n" +
      "crée ou modifie le fichier .htaccess à la racine de www/ (ou du dossier web actif)\n" +
      "avec le contenu affiché ci-dessus."
  );
}

/**
 * Mode FTP_LIST_ONLY=1 : cd vers FTP_REMOTE_DIR puis liste le contenu (dont .htaccess).
 * @param {import("basic-ftp").Client} client
 * @param {{ uploadToCwd: boolean, remoteDir: string, loginPwd: string }} opts
 */
async function runListOnlyMode(client, { uploadToCwd, remoteDir, loginPwd }) {
  console.log(
    `\nMode FTP_LIST_ONLY=1 — cible : ${
      uploadToCwd ? "répertoire courant après login (FTP_REMOTE_DIR=. ou vide)" : `/${remoteDir}/`
    }`
  );

  if (!uploadToCwd) {
    const rootPeek = await client.list(".");
    const dirNames = rootPeek.filter((e) => e.isDirectory).map((e) => e.name);
    if (!dirNames.includes(remoteDir)) {
      const access = await remoteDirIsAccessible(client, remoteDir);
      if (!access) {
        console.error(
          `\nDossier "${remoteDir}" introuvable sous la racine FTP (${loginPwd}).\n` +
            "Dossiers à la racine :\n" +
            (dirNames.length ? dirNames.map((n) => `  - ${n}`).join("\n") : "  (aucun)")
        );
        process.exit(1);
      }
    }
    try {
      await client.cd(remoteDir);
    } catch (err) {
      console.error(`\nImpossible d'entrer dans "${remoteDir}" : ${err?.message ?? err}`);
      process.exit(1);
    }
  }

  const targetPwd = await client.pwd();
  console.log(`Répertoire listé (après cd) : ${targetPwd}\n`);

  const { listing } = await printRemoteListing(
    client,
    uploadToCwd
      ? "Contenu du répertoire courant (FTP_REMOTE_DIR=.)"
      : `Contenu de /${remoteDir}/ (FTP_REMOTE_DIR=${remoteDir})`,
    "."
  );

  const names = (listing ?? []).map((e) => e.name);
  const dotFiles = names.filter((n) => n.startsWith("."));
  if (dotFiles.length) {
    console.log("\n   Fichiers « cachés » (point) :");
    for (const n of dotFiles.sort()) {
      console.log(`     ${n}`);
    }
  }
  if (names.includes(".htaccess")) {
    console.log("\n✓ .htaccess est présent dans ce dossier.");
  } else {
    console.log(
      "\n⚠ .htaccess non listé ici (absent ou non visible en FTP). " +
        "Vérifie via le gestionnaire de fichiers OVH ou ré-uploade-le."
    );
  }

  console.log(
    "\nAucun upload. Pour déployer : retire FTP_LIST_ONLY puis npm run deploy:ovh-ftp"
  );
}

/** @param {import("basic-ftp").Client} client @param {string} remoteDir */
async function remoteDirIsAccessible(client, remoteDir) {
  if (!remoteDir || remoteDir === ".") return true;
  try {
    await client.cd(remoteDir);
    await client.cd("/");
    return true;
  } catch {
    // ignore
  }
  try {
    await client.list(remoteDir);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const fileEnv = readEnvFile(path.join(projectRoot, ".env.local"));
  const password = env("FTP_PASSWORD", fileEnv.FTP_PASSWORD ?? "");

  const host = env("FTP_HOST", DEFAULTS.host);
  const user = env("FTP_USER", DEFAULTS.user);
  const port = Number(env("FTP_PORT", String(DEFAULTS.port))) || DEFAULTS.port;
  const remoteDirRaw = env("FTP_REMOTE_DIR", DEFAULTS.remoteDir).replace(/^\/+|\/+$/g, "");
  const uploadToCwd = !remoteDirRaw || remoteDirRaw === ".";
  const remoteDir = uploadToCwd ? "" : remoteDirRaw;
  const listOnly = env("FTP_LIST_ONLY") === "1";
  const localDir = path.resolve(projectRoot, env("FTP_LOCAL_DIR", DEFAULTS.localDir));

  if (!password) {
    console.error(
      "FTP_PASSWORD manquant. Définis-le dans .env.local ou :\n" +
        '  PowerShell : $env:FTP_PASSWORD="ton_mot_de_passe"; npm run deploy:ovh-ftp'
    );
    process.exit(1);
  }

  if (!listOnly) {
    if (!fs.existsSync(localDir)) {
      console.error(`Dossier local introuvable : ${localDir}\nLance d'abord : npm run build`);
      process.exit(1);
    }
  }

  const entries = listOnly ? [] : await listFilesRecursive(localDir);
  if (!listOnly && entries.length === 0) {
    console.error(`${localDir} est vide. Lance : npm run build`);
    process.exit(1);
  }

  const client = new Client(60_000);
  client.ftp.verbose = env("FTP_VERBOSE") === "1";

  console.log(`Connexion FTP → ${user}@${host}:${port}`);
  if (listOnly) {
    console.log(
      `FTP_LIST_ONLY=1 — exploration de ${
        uploadToCwd ? "la racine courante après login" : `/${remoteDir}/`
      }`
    );
  } else {
    console.log(
      `Cible distante : ${uploadToCwd ? "(répertoire courant après login)" : `/${remoteDir}/`}`
    );
    console.log(`Source locale  : ${localDir}`);
    console.log(`Fichiers       : ${entries.length}`);
  }

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    const passiveMode = applyFtpTransferMode(client);
    console.log(
      `Mode canal de données FTP : ${passiveMode ? "passif (PASV)" : "actif (PORT)"}` +
        (passiveMode ? " — défaut basic-ftp, recommandé OVH mutualisé" : " — FTP_PASSIVE=0")
    );

    const pwd = await client.pwd();
    console.log(`\nRépertoire courant après login (pwd) : ${pwd}`);

    if (listOnly) {
      await runListOnlyMode(client, { uploadToCwd, remoteDir, loginPwd: pwd });
      return;
    }

    const rootList = await printRemoteListing(
      client,
      "Racine FTP — contenu du répertoire courant après connexion",
      "."
    );

    let canUpload = uploadToCwd;
    if (!uploadToCwd) {
      const dirNames = (rootList.dirs ?? []).map((d) => d.name);
      const inListing = dirNames.includes(remoteDir);
      const access = await remoteDirIsAccessible(client, remoteDir);
      canUpload = inListing || access;

      if (!canUpload) {
        console.error(
          `\nDossier cible introuvable : "${remoteDir}"\n` +
            `Le FTP a répondu 553 car ce chemin n'existe pas sous : ${pwd}\n`
        );
        if (dirNames.length) {
          console.error(
            "Dossiers disponibles à la racine :\n" +
              dirNames.map((n) => `  - ${n}`).join("\n") +
              "\n\nCorrige .env.local, par exemple :\n" +
              `  FTP_REMOTE_DIR=${dirNames[0]}\n` +
              "Si la racine courante EST déjà le site web (fichiers index, assets…) :\n" +
              "  FTP_REMOTE_DIR=."
          );
        } else {
          console.error(
            "Aucun sous-dossier listé : tu es peut-être déjà dans la racine web.\n" +
              "Essaie : FTP_REMOTE_DIR=."
          );
        }
        console.error(
          "\nPour lister sans uploader : FTP_LIST_ONLY=1 npm run deploy:ovh-ftp"
        );
        process.exit(1);
      }

      await client.cd(remoteDir);
    }

    const uploadCtx = createUploadContext(await client.pwd());
    console.log(
      `\nRacine de déploiement FTP (miroir de dist/) : ${uploadCtx.uploadBasePwd}\n` +
        "Chemins distants = chemins sous dist/ (indépendants du pwd après mkdir).\n"
    );

    console.log("Nettoyage des fichiers obsolètes sur le serveur distant…");
    await removeObsoleteRemoteFiles(client, uploadCtx);
    console.log("");

    const remoteSubdirs = collectRemoteSubdirs(entries);
    if (remoteSubdirs.length > 0) {
      console.log(`Création de ${remoteSubdirs.length} sous-dossier(s) distant(s)…`);
      await ensureRemoteDirsRecursive(client, uploadCtx, remoteSubdirs);
      for (const d of remoteSubdirs) {
        console.log(`  [mkdir] ${d}`);
      }
      console.log("");
    }

    const uploadOrder = sortEntriesForUpload(entries);
    const total = uploadOrder.length;
    let ok = 0;
    let htaccessManualRequired = false;

    for (const entry of uploadOrder) {
      if (isHtaccessEntry(entry)) {
        try {
          await uploadOneEntry(client, uploadCtx, entry);
          ok += 1;
          console.log(`  [${ok}/${total}] ${entry.rel}`);
        } catch (err) {
          htaccessManualRequired = true;
          printHtaccessManualFallback(entry.localPath, entry.rel, err);
        }
        continue;
      }

      await uploadOneEntry(client, uploadCtx, entry);
      ok += 1;
      console.log(`  [${ok}/${total}] ${entry.rel}`);
    }

    const destLabel = uploadCtx.uploadBasePwd;
    if (htaccessManualRequired) {
      console.log(
        `\nTerminé avec avertissement : ${ok}/${total} fichier(s) uploadé(s) vers ${destLabel}.` +
          "\nLe .htaccess doit être ajouté manuellement (voir ci-dessus) pour les redirects /go/* et le routage SPA."
      );
      process.exitCode = 1;
    } else {
      console.log(`\nTerminé : ${ok} fichier(s) uploadé(s) vers ${destLabel}`);
    }
  } catch (err) {
    console.error("\nÉchec FTP :", err?.message ?? err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
