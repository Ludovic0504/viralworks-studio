/**
 * Proxy Pexels côté serveur (clé PEXELS_API_KEY ou VITE_PEXELS_API_KEY dans Netlify).
 * GET /api/pexels-search?query=...&per_page=1&size=medium
 */
function normalizeKey(raw) {
  if (raw == null) return "";
  let k = String(raw).trim().replace(/^\uFEFF/, "");
  if (k.toLowerCase().startsWith("bearer ")) k = k.slice(7).trim();
  return k;
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  const key = normalizeKey(process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY);
  if (!key) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Clé Pexels manquante côté serveur (PEXELS_API_KEY)" }),
    };
  }

  const qs = event.rawQueryString || "";
  const url = `https://api.pexels.com/v1/search?${qs}`;

  try {
    const res = await fetch(url, { headers: { Authorization: key } });
    const body = await res.text();
    return {
      statusCode: res.status,
      headers,
      body,
    };
  } catch (e) {
    console.error("pexels-search", e);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Échec appel Pexels" }),
    };
  }
};
