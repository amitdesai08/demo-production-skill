#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Automates the access side of demoing a resource the user built themselves (a Foundry
  deployment, an ADF pipeline, or any other Azure resource) — the mechanical half of
  ../skill/references/external-resource-access.md. That file decides WHICH role and WHOSE
  credential; this script performs the actual Azure calls once that decision is made, so
  nothing has to be typed by hand from a doc.

.DESCRIPTION
  Three independent modes, matching the decision procedure's steps 3 and 4:

    -Verify     Read-only. Confirms the current `az` session can see the target resource
                and reports which account/subscription it resolved against. Use this for
                the interactive-credential path — no role, no mutation, nothing to confirm.

    -Plan       Read-only. Prints the EXACT service-principal plan (name, role, scope) that
                -CreateSpn would execute, without creating anything. Show this to the user
                and get their explicit go-ahead before re-running with -CreateSpn — the two
                switches share the same parameters, so what's shown is what gets created.

    -CreateSpn  Mutating. Creates the service principal, assigns the one role at the one
                resource scope given, and writes the credential to a git-ignored local file
                — never to the console, never into any file this repo tracks. Only ever run
                this after a human has approved the -Plan output for the same parameters.

  Least-privilege role selection is NOT this script's job — decide the role using the
  azure-rbac skill (if available) or the fallback table in external-resource-access.md,
  then pass it in with -Role. This script will not guess a role for you.

.EXAMPLE
  # Step 3 (interactive path) — just confirm the current session can see it.
  ./reference-implementation/setup-demo-access.ps1 -Verify -ResourceId /subscriptions/.../resourceGroups/rg-foundry/providers/Microsoft.CognitiveServices/accounts/my-foundry

.EXAMPLE
  # Step 4a/4b — show the plan, change nothing.
  ./reference-implementation/setup-demo-access.ps1 -Plan -ResourceId /subscriptions/.../my-foundry -Role "Cognitive Services User"

.EXAMPLE
  # Step 4c — after the user has explicitly approved the plan above.
  ./reference-implementation/setup-demo-access.ps1 -CreateSpn -ResourceId /subscriptions/.../my-foundry -Role "Cognitive Services User"
#>
[CmdletBinding()]
param(
  [string]$ResourceId,
  [string]$Role,
  [string]$SpnName,
  [int]$YearsValid = 1,
  [string]$OutDir = '.',
  [switch]$Verify,
  [switch]$Plan,
  [switch]$CreateSpn
)

$ErrorActionPreference = 'Stop'

function Step($m) { Write-Host "`n=== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  ok  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !   $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }

$modeCount = @($Verify, $Plan, $CreateSpn) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
if ($modeCount -ne 1) { Die 'give exactly one of -Verify, -Plan or -CreateSpn' }
if (-not $ResourceId) { Die 'give -ResourceId <the exact ARM resource ID being demoed>' }

function Invoke-AzJson {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $out = az @Args 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  if (-not $out) { return $null }
  return ($out | ConvertFrom-Json)
}

# --------------------------------------------------------------- -Verify
if ($Verify) {
  Step 'Verify — current session can see the target resource'
  $ctx = Invoke-AzJson account show
  if (-not $ctx) { Die "not signed in — run 'az login' as the account that should capture this demo" }
  Ok "signed in as $($ctx.user.name), subscription $($ctx.name) ($($ctx.id))"

  $res = Invoke-AzJson resource show --ids $ResourceId
  if (-not $res) { Die "the current session cannot see $ResourceId — wrong tenant, wrong subscription, or no role assignment on it. Ask which account/subscription to use rather than retrying blindly." }
  Ok "resolved: $($res.name) ($($res.type)) in $($res.location)"
  Ok 'interactive credential is usable for this capture — no further setup needed'
  exit 0
}

# Both -Plan and -CreateSpn need a role and a resource to scope it to.
if (-not $Role) { Die '-Role is required for -Plan/-CreateSpn — pick it via the azure-rbac skill or the fallback table in external-resource-access.md; this script does not guess one' }
$resInfo = Invoke-AzJson resource show --ids $ResourceId
if (-not $resInfo) { Die "cannot resolve $ResourceId with the current session — run -Verify first" }
if (-not $SpnName) {
  $slug = ($resInfo.name -replace '[^a-zA-Z0-9-]', '-').ToLower()
  $SpnName = "spn-demo-$slug-capture"
}

# --------------------------------------------------------------- -Plan
if ($Plan) {
  Step 'Plan — nothing below is created until this same command is re-run with -CreateSpn'
  Write-Host "  Service principal : $SpnName"
  Write-Host "  Role assigned     : $Role"
  Write-Host "  Scope             : $ResourceId"
  Write-Host "  Resource resolved : $($resInfo.name) ($($resInfo.type))"
  Write-Host "  Secret expiry     : $YearsValid year(s)"
  Write-Host "  Credential written to : $OutDir/.env.$SpnName (git-ignored; never printed to console)"
  Warn 'Show this plan to the user and get explicit approval before running with -CreateSpn.'
  exit 0
}

# --------------------------------------------------------------- -CreateSpn
Step "Create SPN '$SpnName' scoped to $($resInfo.name), role '$Role'"
Warn 'This creates a real identity and role assignment in the tenant. Only proceed if the -Plan above was already shown to and approved by the user.'

$sp = Invoke-AzJson ad sp create-for-rbac --name $SpnName --role $Role --scopes $ResourceId --years $YearsValid
if (-not $sp) { Die 'az ad sp create-for-rbac failed — see the az error above' }
Ok "created $SpnName (appId $($sp.appId))"

# Tag it as a demo-capture identity so it reads as one later, not as an unexplained SPN.
az ad sp update --id $sp.appId --set "tags=[`"demo-capture`",`"managed-by:demo-production-skill`"]" 2>$null | Out-Null

$envFile = Join-Path $OutDir ".env.$SpnName"
@(
  "# Demo-capture identity for $($resInfo.name) — created $(Get-Date -Format o)"
  "# Scope: $ResourceId"
  "# Role: $Role"
  "# Git-ignored by the repo's .env.* pattern — never commit this file."
  "AZURE_CLIENT_ID=$($sp.appId)"
  "AZURE_TENANT_ID=$($sp.tenant)"
  "AZURE_CLIENT_SECRET=$($sp.password)"
) | Set-Content -Path $envFile -Encoding utf8

Ok "credential written to $envFile — not printed above, not committed (matches the repo's .env.* .gitignore pattern)"
Warn "record this SPN in the track's disclaimer (name, scope, role) per external-resource-access.md — and set a reminder to remove or rotate it when the track is retired"
Warn 'client-secret auth was used because this is the always-works fallback; if this capture runs somewhere that supports workload identity federation (e.g. GitHub Actions), prefer that instead and skip the secret entirely — see Microsoft Learn "workload identity federation" for the federated-credential setup, which is deliberately not automated here since it is specific to where the capture runs.'
