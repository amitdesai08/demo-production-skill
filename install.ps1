#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Installs the demo-production skill (and optionally its reference implementation) into
    another repository.

.EXAMPLE
    ./install.ps1 -TargetRepo ../some-other-project
.EXAMPLE
    ./install.ps1 -TargetRepo ../some-other-project -WithReferenceImplementation
.EXAMPLE
    ./install.ps1 -TargetRepo ../some-other-project -Target claude
.EXAMPLE
    ./install.ps1 -Personal   # into your own skills folders, for every repo you open
#>
[CmdletBinding()]
param(
    [string] $TargetRepo,
    [ValidateSet('github', 'claude', 'agents', 'all')] [string] $Target = 'github',
    [switch] $WithReferenceImplementation,
    [switch] $Personal,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = $PSScriptRoot

function Install-Skill([string] $ParentFolder) {
    $dest = Join-Path $ParentFolder 'demo-production'
    if ((Test-Path $dest) -and -not $Force) {
        throw "$dest already exists. Pass -Force to overwrite."
    }
    if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
    New-Item -Path $dest -ItemType Directory -Force | Out-Null
    Copy-Item -Path (Join-Path $root 'demo-production/*') -Destination $dest -Recurse -Force
    Write-Host "Installed the skill to $dest" -ForegroundColor Green
}

if ($Personal) {
    # Each tool reads its own folder; the files are identical, so installing to all of them
    # costs nothing and means the skill is there whichever one you happen to open.
    foreach ($d in @("$HOME/.agents/skills", "$HOME/.claude/skills", "$HOME/.copilot/skills")) {
        New-Item -Path $d -ItemType Directory -Force | Out-Null
        Install-Skill $d
    }
    return
}

if (-not $TargetRepo) {
    throw 'Specify -TargetRepo <path>, or -Personal to install into your own skills folders.'
}
if (-not (Test-Path -Path $TargetRepo -PathType Container)) {
    throw "Target repo folder not found: $TargetRepo"
}
# Any Copilot-, Claude Code-, or Agents-compatible session in the target repo reads its own
# convention — installing to more than one costs nothing (same files, three folder names).
$folders = switch ($Target) {
    'github' { @('.github/skills') }
    'claude' { @('.claude/skills') }
    'agents' { @('.agents/skills') }
    'all'    { @('.github/skills', '.claude/skills', '.agents/skills') }
}

foreach ($folder in $folders) {
    $parent = Join-Path $TargetRepo $folder
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
    Install-Skill $parent
}

if ($WithReferenceImplementation) {
    $demoDest = Join-Path $TargetRepo 'demo'
    if ((Test-Path $demoDest) -and -not $Force) {
        Write-Warning "$demoDest already exists — skipping (pass -Force to overwrite it too)."
    } else {
        if (Test-Path $demoDest) { Remove-Item -Path $demoDest -Recurse -Force }
        New-Item -Path $demoDest -ItemType Directory -Force | Out-Null
        Copy-Item -Path (Join-Path $root 'reference-implementation/*') -Destination $demoDest -Recurse -Force
        Write-Host "Installed the reference implementation to $demoDest" -ForegroundColor Green
        Write-Host "Run 'npm install' in $demoDest (the Speech SDK is its only dependency), then read $demoDest/CONFIGURE.md." -ForegroundColor DarkGray
    }
}

Write-Host "`nCommit both into $TargetRepo so the whole team gets them on their next pull." -ForegroundColor DarkGray
