# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n >> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    + $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "    ~ $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "`n [!] $msg`n" -ForegroundColor Red; exit 1 }

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Install-WithWinget($id, $name) {
    if (Has "winget") {
        Write-Info "$name not found. Installing via winget..."
        winget install --id $id -e --source winget --silent --accept-package-agreements --accept-source-agreements
        Refresh-Path
    } else {
        return $false
    }
    return $true
}

Write-Host ""
Write-Host "  Equicord + QuestCompleter Installer" -ForegroundColor White
Write-Host ""
Write-Step "Checking Git..."

if (-not (Has "git")) {
    $ok = Install-WithWinget "Git.Git" "Git"
    if (-not $ok -or -not (Has "git")) {
        Write-Info "winget unavailable. Downloading Git installer..."
        $gitInstaller = "$env:TEMP\git-installer.exe"
        Invoke-WebRequest "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe" -OutFile $gitInstaller
        Start-Process $gitInstaller "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Wait
        Refresh-Path
    }
}

if (-not (Has "git")) { Write-Fail "Git installation failed. Install manually from https://git-scm.com" }
Write-OK "Git $(git --version)"
Write-Step "Checking Node.js..."

if (-not (Has "node")) {
    $ok = Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js"
    if (-not $ok -or -not (Has "node")) {
        Write-Info "winget unavailable. Downloading Node.js installer..."
        $nodeInstaller = "$env:TEMP\node-installer.msi"
        Invoke-WebRequest "https://nodejs.org/dist/v20.14.0/node-v20.14.0-x64.msi" -OutFile $nodeInstaller
        Start-Process msiexec "/i `"$nodeInstaller`" /quiet /norestart" -Wait
        Refresh-Path
    }
}

if (-not (Has "node")) { Write-Fail "Node.js installation failed. Install manually from https://nodejs.org" }
Write-OK "Node $(node --version)"
Write-Step "Checking pnpm..."

if (-not (Has "pnpm")) {
    Write-Info "Installing pnpm..."
    npm install -g pnpm
    Refresh-Path
}

if (-not (Has "pnpm")) { Write-Fail "pnpm installation failed." }
Write-OK "pnpm $(pnpm --version)"
Write-Step "Setting up Equicord..."

$installDir = "$env:USERPROFILE\Equicord"

if (Test-Path "$installDir\.git") {
    Write-Info "Equicord already cloned, pulling latest..."
    git -C $installDir pull --ff-only
} else {
    git clone https://github.com/Equicord/Equicord.git $installDir
}
Write-OK "Equicord at $installDir"
Write-Step "Installing QuestCompleter plugin..."

$pluginDir = "$installDir\src\userplugins\QuestCompleter"

if (Test-Path "$pluginDir\.git") {
    Write-Info "Plugin already exists, pulling latest..."
    git -C $pluginDir pull --ff-only
} else {
    git clone https://github.com/itskonv1/QuestCompleter.git $pluginDir
}
Write-OK "Plugin ready"
Write-Step "Installing dependencies..."
pnpm install --frozen-lockfile --dir $installDir
Write-Step "Building..."
pnpm --dir $installDir build

Write-Step "Injecting into Discord..."
pnpm --dir $installDir inject

Write-Host ""
Write-Host "  Done! QuestCompleter is installed." -ForegroundColor Green
Write-Host ""
Write-Host "  1. Fully close Discord (check system tray)" -ForegroundColor Gray
Write-Host "  2. Reopen Discord" -ForegroundColor Gray
Write-Host "  3. Settings > Plugins > UserPlugins > QuestCompleter" -ForegroundColor Gray
Write-Host ""
