/**
 * Mock génération avatar — POST /api/studio/generate-avatar
 * Prod Vercel : api/studio/generate-avatar.js
 */

import { buildMockAvatarResponse } from "./mockAvatarResponse.js";

export default async function handler(req, res) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée. Utilisez POST." });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "Corps JSON invalide." });
  }

  await new Promise((r) => setTimeout(r, 800));

  return res.status(200).json(buildMockAvatarResponse(body));
}
