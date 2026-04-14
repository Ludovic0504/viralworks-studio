# Accorde à l'agent Vertex AI le droit d'écrire les vidéos Veo dans un bucket GCS.
# Prérequis : Google Cloud SDK (gcloud), compte connecté : gcloud auth login
#
# Usage :
#   .\scripts\grant-vertex-veo-bucket-iam.ps1 -VerifyOnly
#   .\scripts\grant-vertex-veo-bucket-iam.ps1
#   .\scripts\grant-vertex-veo-bucket-iam.ps1 -BucketName "mon-bucket" -VertexProjectNumber "123456789" -BucketProjectId "mon-projet-gcp"
#   .\scripts\grant-vertex-veo-bucket-iam.ps1 -UseObjectAdmin # dépannage si objectCreator ne suffit pas
#
# Le VertexProjectNumber est dans l'erreur : service-<CE_NUMERO>@gcp-sa-aiplatform...

param(
  [string]$BucketName = "viralworks-veo-output",
  [string]$VertexProjectNumber = "194362260482",
  [string]$BucketProjectId = "",
  [switch]$VerifyOnly,
  [switch]$UseObjectAdmin
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Error "gcloud introuvable. Installe Google Cloud SDK puis relance ce script, ou ajoute l'IAM à la main (Console)."
}

$agent = "service-${VertexProjectNumber}@gcp-sa-aiplatform.iam.gserviceaccount.com"
$gs = "gs://$BucketName"
$role = if ($UseObjectAdmin) { "roles/storage.objectAdmin" } else { "roles/storage.objectCreator" }

Write-Host ""
Write-Host "Bucket : $gs"
Write-Host "Agent Vertex (à voir dans les bindings IAM) : $agent"
Write-Host "Console (onglet Permissions) : https://console.cloud.google.com/storage/browser/$BucketName`?tab=permissions"
Write-Host ""

if ($VerifyOnly) {
  Write-Host "--- Contenu IAM actuel du bucket (recherche $agent) ---"
  $getArgs = @("storage", "buckets", "get-iam-policy", $gs, "--format=json")
  if ($BucketProjectId.Trim()) { $getArgs += "--project=$($BucketProjectId.Trim())" }
  $json = & gcloud @getArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Impossible de lire la politique (bucket inexistant, mauvais projet, ou pas les droits). Sortie : $json"
    exit $LASTEXITCODE
  }
  $policy = $json | ConvertFrom-Json
  $found = $false
  foreach ($b in $policy.bindings) {
    foreach ($m in $b.members) {
      if ($m -eq "serviceAccount:$agent") {
        Write-Host "OK trouvé : $($b.role) pour $m"
        $found = $true
      }
    }
  }
  if (-not $found) {
    Write-Host "AUCUN binding pour serviceAccount:$agent — ajoute le rôle $role (ou roles/storage.objectCreator) sur ce bucket."
  }
  exit 0
}

$args = @(
  "storage", "buckets", "add-iam-policy-binding", $gs,
  "--member=serviceAccount:$agent",
  "--role=$role"
)
if ($BucketProjectId.Trim()) {
  $args += "--project=$($BucketProjectId.Trim())"
}

Write-Host "Exécution : gcloud $($args -join ' ')"
& gcloud @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
Write-Host "OK : $agent a $role sur $gs"
Write-Host "Relance avec -VerifyOnly pour confirmer le binding."
