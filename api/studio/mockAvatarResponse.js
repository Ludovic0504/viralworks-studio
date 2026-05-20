/**
 * Réponse mock partagée entre Vercel (api/) et Netlify Dev (netlify/functions/).
 */

const MOCK_FACE_URL =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=512&h=640&fit=crop";

const MOCK_TRIPTYQUE_URL =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=768&h=512&fit=crop";

export function buildMockAvatarResponse(body) {
  const format = body?.format === "triptyque" ? "triptyque" : "face";
  const avatarUrl = format === "triptyque" ? MOCK_TRIPTYQUE_URL : MOCK_FACE_URL;

  return {
    avatarUrl,
    format,
    jobId: `mock-${Date.now()}`,
    creditsUsed: format === "triptyque" ? 4 : 2,
  };
}
