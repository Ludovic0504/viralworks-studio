/**
 * Réponse mock partagée entre Vercel (api/) et Netlify Dev (netlify/functions/).
 */

const MOCK_CHARACTER_SHEET_URL =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1024&h=1024&fit=crop";

export function buildMockAvatarResponse(body) {
  return {
    avatarUrl: MOCK_CHARACTER_SHEET_URL,
    format: "character_sheet",
    jobId: `mock-${Date.now()}`,
    creditsUsed: 4,
  };
}
