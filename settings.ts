/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    autoStart: {
        description: "Automatically enroll and start unenrolled quests",
        type: OptionType.BOOLEAN,
        default: true,
    },
    autoClaim: {
        description: "Automatically claim reward after quest completion",
        type: OptionType.BOOLEAN,
        default: true,
    },
    showNotifications: {
        description: "Show toast notifications for quest events",
        type: OptionType.BOOLEAN,
        default: true,
    },
    showProgressBar: {
        description: "Show a progress bar while quests are running",
        type: OptionType.BOOLEAN,
        default: false,
    },
    completeVideoQuestsQuicker: {
        description: "Use elapsed enrollment time for Video Quest auto completion",
        type: OptionType.BOOLEAN,
        default: true,
    },
    makeMobileVideoQuestsDesktopCompatible: {
        description: "Make mobile-only Video Quests compatible with desktop",
        type: OptionType.BOOLEAN,
        default: true,
    },
    debugMode: {
        description: "Show detailed debug logs in the browser console",
        type: OptionType.BOOLEAN,
        default: false,
    }
});
