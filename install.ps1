#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Installs the demo-production skill (and optionally its reference implementation) into
    another repository.

.EXAMPLE
    ./install.ps1 -TargetRepo ../some-other-project
.EXAMPLE
    ./install.ps1 -TargetRepo ../some-other-project -WithReferenceImplementation
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $TargetRepo,
    [switch] $WithReferenceImplementation,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -Path $TargetRepo -PathType Container)) {
    throw "Target repo folder not found: $TargetRepo"
}

$root = $PSScriptRoot
$skillDest = Join-Path $TargetRepo '.github/skills/demo-production'

if ((Test-Path $skillDest) -and -not $Force) {
    throw "$skillDest already exists. Pass -Force to overwrite."
}
if (Test-Path $skillDest) { Remove-Item -Path $skillDest -Recurse -Force }

New-Item -Path $skillDest -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $root 'skill/*') -Destination $skillDest -Recurse -Force
Write-Host "Installed the skill to $skillDest" -ForegroundColor Green

if ($WithReferenceImplementation) {
    $demoDest = Join-Path $TargetRepo 'demo'
    if ((Test-Path $demoDest) -and -not $Force) {
        Write-Warning "$demoDest already exists — skipping (pass -Force to overwrite it too)."
    } else {
        if (Test-Path $demoDest) { Remove-Item -Path $demoDest -Recurse -Force }
        New-Item -Path $demoDest -ItemType Directory -Force | Out-Null
        Copy-Item -Path (Join-Path $root 'reference-implementation/*') -Destination $demoDest -Recurse -Force
        Write-Host "Installed the reference implementation to $demoDest" -ForegroundColor Green
        Write-Host "Read $demoDest/CONFIGURE.md next." -ForegroundColor DarkGray
    }
}

Write-Host "`nCommit both into $TargetRepo so the whole team gets them on their next pull." -ForegroundColor DarkGray
