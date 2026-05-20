/**
 * Mock POST /api/studio/generate-avatar en dev Vite sans Netlify Dev (:8888).
 */
import { buildMockAvatarResponse } from "../api/studio/mockAvatarResponse.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function studioAvatarApiDev() {
  return {
    name: "studio-avatar-api-dev",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        if (pathname !== "/api/studio/generate-avatar") {
          return next();
        }

        if (req.method === "OPTIONS") {
          res.writeHead(200, CORS_HEADERS);
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.writeHead(405, CORS_HEADERS);
          res.end(JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }));
          return;
        }

        try {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          await new Promise((r) => setTimeout(r, 800));
          const payload = buildMockAvatarResponse(body);
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify(payload));
        } catch {
          res.writeHead(400, CORS_HEADERS);
          res.end(JSON.stringify({ error: "Corps JSON invalide." }));
        }
      });
    },
  };
}
