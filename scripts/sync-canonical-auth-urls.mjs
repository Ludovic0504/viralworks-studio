/**
 * Supprime toute URL Netlify de la config Auth Supabase et force le domaine canonique.
 * Usage CI : SUPABASE_ACCESS_TOKEN requis (secret GitHub Actions).
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "wuvtfhletxieocetzppo";
const CANONICAL_ORIGIN = "https://viralworks-studio.com";
const BLOCKED = /netlify\.app/i;

const REQUIRED_REDIRECTS = [
  `${CANONICAL_ORIGIN}/auth/callback`,
  `${CANONICAL_ORIGIN}/auth/confirm`,
  `${CANONICAL_ORIGIN}/`,
  "http://localhost:5173/auth/callback",
  "http://localhost:5173/",
  "http://127.0.0.1:5173/auth/callback",
];

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN manquant.");
    process.exit(1);
  }

  const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(endpoint, { headers });
  if (!getRes.ok) {
    console.error("GET auth config failed:", getRes.status, await getRes.text());
    process.exit(1);
  }

  const current = await getRes.json();
  const beforeSite = current.site_url || "";
  const beforeRedirects = Array.isArray(current.additional_redirect_urls)
    ? current.additional_redirect_urls
    : [];

  const removed = beforeRedirects.filter((url) => BLOCKED.test(String(url)));
  const kept = beforeRedirects.filter((url) => !BLOCKED.test(String(url)));
  const additional_redirect_urls = uniq([...kept, ...REQUIRED_REDIRECTS]);

  const site_url = BLOCKED.test(beforeSite) ? CANONICAL_ORIGIN : beforeSite || CANONICAL_ORIGIN;
  const nextSite = site_url === beforeSite ? site_url : CANONICAL_ORIGIN;

  const needsPatch =
    removed.length > 0 ||
    BLOCKED.test(beforeSite) ||
    nextSite !== beforeSite ||
    additional_redirect_urls.length !== beforeRedirects.length;

  if (removed.length) {
    console.log("URLs Netlify retirées de Auth redirect:", removed);
  }

  if (!needsPatch) {
    console.log("OK: aucune URL Netlify dans Supabase Auth.");
    return;
  }

  const patchRes = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      site_url: CANONICAL_ORIGIN,
      additional_redirect_urls,
    }),
  });

  if (!patchRes.ok) {
    console.error("PATCH auth config failed:", patchRes.status, await patchRes.text());
    process.exit(1);
  }

  console.log("Supabase Auth mis à jour:", {
    site_url: CANONICAL_ORIGIN,
    redirect_count: additional_redirect_urls.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
