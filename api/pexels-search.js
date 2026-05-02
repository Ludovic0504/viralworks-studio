/**
 * Proxy Pexels côté serveur (clé PEXELS_API_KEY ou VITE_PEXELS_API_KEY dans Vercel).
 * GET /api/pexels-search?query=...&per_page=1&size=medium
 */

function normalizeKey(raw) {
  if (raw == null) return "";
  let k = String(raw).trim().replace(/^\uFEFF/, "");
  if (k.toLowerCase().startsWith("bearer ")) k = k.slice(7).trim();
  return k;
}

function getRawQueryString(req) {
  const pathOrUrl = req.url || "";
  const idx = pathOrUrl.indexOf("?");
  return idx >= 0 ? pathOrUrl.slice(idx + 1) : "";
}

export default async function handler(req, res) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const key = normalizeKey(process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY);
  if (!key) {
    return res.status(500).json({
      error: "Clé Pexels manquante côté serveur (PEXELS_API_KEY ou VITE_PEXELS_API_KEY)",
    });
  }

  const qs = getRawQueryString(req);
  const url = `https://api.pexels.com/v1/search?${qs}`;

  try {
    const upstream = await fetch(url, { headers: { Authorization: key } });
    const body = await upstream.text();
    return res.status(upstream.status).send(body);
  } catch (e) {
    console.error("pexels-search", e);
    return res.status(502).json({ error: "Échec appel Pexels" });
  }
}
