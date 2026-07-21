# Définir les secrets OAuth sociaux sur le projet Supabase lié.
# Usage (PowerShell) — remplis les valeurs puis lance :
#   .\scripts\set-social-oauth-secrets.ps1
#
# Callback OAuth à coller dans chaque console développeur :
#   https://wuvtfhletxieocetzppo.supabase.co/functions/v1/social-oauth-callback

$ErrorActionPreference = "Stop"

$MetaAppId = $env:META_APP_ID
$MetaAppSecret = $env:META_APP_SECRET
$TikTokKey = $env:TIKTOK_CLIENT_KEY
$TikTokSecret = $env:TIKTOK_CLIENT_SECRET
$YoutubeId = $env:YOUTUBE_CLIENT_ID
$YoutubeSecret = $env:YOUTUBE_CLIENT_SECRET

$missing = @()
if (-not $MetaAppId) { $missing += "META_APP_ID" }
if (-not $MetaAppSecret) { $missing += "META_APP_SECRET" }
if (-not $TikTokKey) { $missing += "TIKTOK_CLIENT_KEY" }
if (-not $TikTokSecret) { $missing += "TIKTOK_CLIENT_SECRET" }
if (-not $YoutubeId) { $missing += "YOUTUBE_CLIENT_ID" }
if (-not $YoutubeSecret) { $missing += "YOUTUBE_CLIENT_SECRET" }

if ($missing.Count -gt 0) {
  Write-Host "Secrets manquants dans l'environnement :"
  $missing | ForEach-Object { Write-Host "  - $_" }
  Write-Host ""
  Write-Host "Exemple :"
  Write-Host '  $env:META_APP_ID="..."'
  Write-Host '  $env:META_APP_SECRET="..."'
  Write-Host '  $env:TIKTOK_CLIENT_KEY="..."'
  Write-Host '  $env:TIKTOK_CLIENT_SECRET="..."'
  Write-Host '  $env:YOUTUBE_CLIENT_ID="..."'
  Write-Host '  $env:YOUTUBE_CLIENT_SECRET="..."'
  Write-Host '  .\scripts\set-social-oauth-secrets.ps1'
  exit 1
}

npx supabase secrets set `
  "META_APP_ID=$MetaAppId" `
  "META_APP_SECRET=$MetaAppSecret" `
  "TIKTOK_CLIENT_KEY=$TikTokKey" `
  "TIKTOK_CLIENT_SECRET=$TikTokSecret" `
  "YOUTUBE_CLIENT_ID=$YoutubeId" `
  "YOUTUBE_CLIENT_SECRET=$YoutubeSecret"

Write-Host "OK — secrets OAuth poussés sur Supabase."
Write-Host "Callback : https://wuvtfhletxieocetzppo.supabase.co/functions/v1/social-oauth-callback"
