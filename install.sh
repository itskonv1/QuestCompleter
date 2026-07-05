#!/bin/bash
#
# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}Equicord + QuestCompleter Installer${NC}"
echo

OS="$(uname)"

ensure_brew() {
    if ! command -v brew >/dev/null 2>&1; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
    fi
}

install_package() {
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -y
        sudo apt-get install -y "$1"
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y "$1"
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y "$1"
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -S --noconfirm "$1"
    else
        echo -e "${RED}Unsupported Linux distribution.${NC}"
        exit 1
    fi
}

echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v git >/dev/null 2>&1; then
    echo "Installing Git..."
    if [ "$OS" = "Darwin" ]; then
        ensure_brew
        brew install git
    elif [[ "$OS" == *"MINGW"* || "$OS" == *"MSYS"* || "$OS" == *"CYGWIN"* ]]; then
        winget install --id Git.Git -e --source winget --silent
    else
        install_package git
    fi
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Installing Node.js..."
    if [ "$OS" = "Darwin" ]; then
        ensure_brew
        brew install node
    elif [[ "$OS" == *"MINGW"* || "$OS" == *"MSYS"* || "$OS" == *"CYGWIN"* ]]; then
        winget install --id OpenJS.NodeJS.LTS -e --source winget --silent
    else
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        install_package nodejs
        if ! command -v npm >/dev/null 2>&1; then
            install_package npm
        fi
    fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

echo
echo "Git   : $(git --version)"
echo "Node  : $(node -v)"
echo "pnpm  : $(pnpm -v)"

TARGET_DIR="Equicord"

echo
echo -e "${BLUE}Setting up repositories...${NC}"

if [ -d "$TARGET_DIR/.git" ]; then
    git -C "$TARGET_DIR" pull --ff-only
else
    git clone https://github.com/Equicord/Equicord.git "$TARGET_DIR"
fi

PLUGIN_DIR="$TARGET_DIR/src/userplugins/QuestCompleter"

if [ -d "$PLUGIN_DIR/.git" ]; then
    git -C "$PLUGIN_DIR" pull --ff-only
else
    git clone https://github.com/itskonv1/QuestCompleter.git "$PLUGIN_DIR"
fi

cd "$TARGET_DIR"

echo
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install --frozen-lockfile

echo
echo -e "${BLUE}Building Equicord...${NC}"
pnpm build

echo
echo -e "${BLUE}Closing Discord if running...${NC}"
if [[ "$OS" == *"MINGW"* || "$OS" == *"MSYS"* || "$OS" == *"CYGWIN"* ]]; then
    taskkill /F /IM Discord.exe >/dev/null 2>&1 || true
    taskkill /F /IM DiscordCanary.exe >/dev/null 2>&1 || true
    taskkill /F /IM DiscordPTB.exe >/dev/null 2>&1 || true
    taskkill /F /IM DiscordDevelopment.exe >/dev/null 2>&1 || true
elif [ "$OS" = "Darwin" ]; then
    pkill -x Discord >/dev/null 2>&1 || true
    pkill -x "Discord Canary" >/dev/null 2>&1 || true
    pkill -x "Discord PTB" >/dev/null 2>&1 || true
    pkill -x "Discord Development" >/dev/null 2>&1 || true
else
    pkill -f discord >/dev/null 2>&1 || true
    pkill -f Discord >/dev/null 2>&1 || true
fi

echo
echo -e "${BLUE}Injecting into Discord...${NC}"
pnpm inject

echo
echo -e "${GREEN}Installation completed successfully!${NC}"
echo "Completely close Discord (including the system tray) and launch it again."
