/**
 * Mock génération avatar — dev local via Netlify Dev
 * Route : POST /api/studio/generate-avatar → /.netlify/functions/studio/generate-avatar
 */

import { buildMockAvatarResponse } from "../../../api/studio/mockAvatarResponse.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }),
    };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Corps JSON invalide." }),
    };
  }

  await new Promise((r) => setTimeout(r, 800));

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(buildMockAvatarResponse(body)),
  };
};
