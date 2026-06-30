/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuestTaskType } from "@vencord/discord-types/enums";

import { settings } from "./settings";

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export const desktopVideoCompatibilityQuestIds = new Set<string>();

const TASK_PRIORITY = [
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_DESKTOP_V2,
    QuestTaskType.PLAY_ON_XBOX,
    QuestTaskType.PLAY_ON_PLAYSTATION,
    QuestTaskType.PLAY_ACTIVITY,
    QuestTaskType.WATCH_VIDEO,
    QuestTaskType.WATCH_VIDEO_ON_MOBILE,
    QuestTaskType.ACHIEVEMENT_IN_GAME,
    QuestTaskType.ACHIEVEMENT_IN_ACTIVITY,
    QuestTaskType.STREAM_ON_DESKTOP,
] as const;

export const VIDEO_LEEWAY = 24;

export function getQuestTask(quest: any): { type: QuestTaskType; target: number; applications?: any[]; } | null {
    const tasks = quest.config?.taskConfigV2?.tasks ?? quest.config?.taskConfig?.tasks;
    if (!tasks) return null;

    for (const type of TASK_PRIORITY) {
        if (tasks[type]) {
            return {
                type,
                target: tasks[type].target ?? 1,
                applications: tasks[type].applications
            };
        }
    }
    return null;
}

export function getQuestTarget(task: { type: QuestTaskType; target: number; }, completeVideoQuestsQuicker: boolean): { raw: number; adjusted: number; } {
    const isWatch =
        task.type === QuestTaskType.WATCH_VIDEO ||
        task.type === QuestTaskType.WATCH_VIDEO_ON_MOBILE ||
        task.type === QuestTaskType.STREAM_ON_DESKTOP;
    const raw = task.target;
    const adjusted = Math.max(0, raw - (isWatch && completeVideoQuestsQuicker ? VIDEO_LEEWAY : 0));
    return { raw, adjusted };
}

export function getQuestProgress(quest: any, task: { type: QuestTaskType; target: number; }): number {
    const progressMap = quest.userStatus?.progress;
    if (!progressMap) return 0;

    if (
        task.type === QuestTaskType.WATCH_VIDEO ||
        task.type === QuestTaskType.WATCH_VIDEO_ON_MOBILE ||
        task.type === QuestTaskType.STREAM_ON_DESKTOP
    ) {
        const watchVal = progressMap[QuestTaskType.WATCH_VIDEO]?.value ?? 0;
        const mobileVal = progressMap[QuestTaskType.WATCH_VIDEO_ON_MOBILE]?.value ?? 0;
        const streamVal = progressMap[QuestTaskType.STREAM_ON_DESKTOP]?.value ?? 0;
        return Math.max(watchVal, mobileVal, streamVal);
    }

    return progressMap[task.type]?.value ?? 0;
}

export function injectDesktopVideoQuestTasks(quests: any[]): void {
    for (const quest of quests) {
        const tasks = quest.config?.taskConfigV2?.tasks;
        if (!tasks) continue;

        const mobileVideoTask = tasks[QuestTaskType.WATCH_VIDEO_ON_MOBILE];
        if (!mobileVideoTask || tasks[QuestTaskType.WATCH_VIDEO]) continue;

        quest.config.taskConfigV2.tasks = {
            ...tasks,
            [QuestTaskType.WATCH_VIDEO]: {
                ...mobileVideoTask,
                type: QuestTaskType.WATCH_VIDEO
            }
        };
        desktopVideoCompatibilityQuestIds.add(quest.id);
    }
}

export function decimalToRGB(decimal: number): RGB {
    return {
        r: (decimal >> 16) & 0xff,
        g: (decimal >> 8) & 0xff,
        b: decimal & 0xff
    };
}

export function adjustRGB(rgb: RGB, shift: number): RGB {
    return {
        r: Math.max(0, Math.min(255, rgb.r + shift)),
        g: Math.max(0, Math.min(255, rgb.g + shift)),
        b: Math.max(0, Math.min(255, rgb.b + shift))
    };
}

export function isDarkish(rgb: RGB, threshold: number = 0.5): boolean {
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < threshold;
}

export function getQuestTileClasses(originalClasses: string, quest: any): string {
    if (originalClasses.includes("dummy-quest")) return originalClasses;

    const baseClasses = originalClasses.split(" ").filter(cls => cls && !cls.startsWith("qcp-"));
    const returnClasses: string[] = [...baseClasses, "qcp-quest-item-restyle"];

    const themeColor = quest.config?.colors?.primary;
    if (themeColor !== undefined && themeColor !== null) {
        const rgb = decimalToRGB(themeColor);
        returnClasses.push("qcp-quest-item-default-gradient");
        if (!isDarkish(rgb, 0.875)) {
            returnClasses.push("qcp-quest-item-contrast-logo");
        }
    }

    return returnClasses.join(" ");
}

export function getQuestTileStyle(quest: any): Record<string, string> {
    const style: Record<string, string> = {};
    const primaryColor = quest?.config?.colors?.primary;
    const themeColorObj = (primaryColor !== undefined && primaryColor !== null)
        ? decimalToRGB(primaryColor)
        : { r: 88, g: 101, b: 242 };

    const darkish = isDarkish(themeColorObj);
    const sign = darkish ? 1 : -1;
    const toRgbString = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;

    style["--qcp-color"] = toRgbString(themeColorObj);
    style["--qcp-quest-name"] = toRgbString(adjustRGB(themeColorObj, 200 * sign));
    style["--qcp-reward-title"] = toRgbString(adjustRGB(themeColorObj, 150 * sign));
    style["--qcp-reward-description"] = toRgbString(adjustRGB(themeColorObj, 100 * sign));
    style["--qcp-button-normal"] = toRgbString(adjustRGB(themeColorObj, 50 * sign));
    style["--qcp-button-hover"] = toRgbString(adjustRGB(themeColorObj, 75 * sign));

    return style;
}

export function getQuestUnacceptedButtonText(quest: any): string | null {
    if (!quest) return null;
    const task = getQuestTask(quest);
    if (!task) return null;
    const { adjusted: target } = getQuestTarget(task, settings.store.completeVideoQuestsQuicker);
    if (target <= 0) return null;

    if (task.type === QuestTaskType.ACHIEVEMENT_IN_ACTIVITY) return "Complete (Immediate)";

    const mm = String(Math.floor(target / 60)).padStart(2, "0");
    const ss = String(target % 60).padStart(2, "0");
    return `Complete (${mm}:${ss})`;
}

export function getQuestAcceptedButtonText(quest: any): string | null {
    if (!quest) return null;
    const enrolledAt = quest.userStatus?.enrolledAt ? new Date(quest.userStatus.enrolledAt) : null;
    if (!enrolledAt) return null;

    const task = getQuestTask(quest);
    if (!task) return null;

    if (task.type === QuestTaskType.ACHIEVEMENT_IN_ACTIVITY) return "Complete (Immediate)";

    const { adjusted: duration } = getQuestTarget(task, settings.store.completeVideoQuestsQuicker);
    const currentProgress = getQuestProgress(quest, task);
    const progress = Math.min(currentProgress, duration);
    const timeRemaining = Math.max(0, Math.floor(duration - progress));

    const isWatch =
        task.type === QuestTaskType.WATCH_VIDEO ||
        task.type === QuestTaskType.WATCH_VIDEO_ON_MOBILE ||
        task.type === QuestTaskType.STREAM_ON_DESKTOP;

    const elapsedSec = (Date.now() - enrolledAt.getTime()) / 1000;
    const canCompleteImmediately = isWatch && elapsedSec >= duration;

    if (canCompleteImmediately) return "Complete (Immediate)";

    const mm = String(Math.floor(timeRemaining / 60)).padStart(2, "0");
    const ss = String(timeRemaining % 60).padStart(2, "0");

    return timeRemaining === Math.floor(duration)
        ? `Complete (${mm}:${ss})`
        : `Resume (${mm}:${ss})`;
}

export function getQuestPanelPercentComplete(args: {
    quest?: any;
    children?: { props?: { quest?: any; }; };
    percentComplete?: number;
    percentCompleteText?: string;
    completeVideoQuestsQuicker?: boolean;
}): { percentComplete: number; percentCompleteText?: string; } | null {
    const quest = args.quest ?? args.children?.props?.quest;
    if (!quest) return null;

    const task = getQuestTask(quest);
    if (!task) return null;

    const { adjusted: questTarget } = getQuestTarget(task, args.completeVideoQuestsQuicker ?? settings.store.completeVideoQuestsQuicker);
    const questProgress = getQuestProgress(quest, task);

    if (!questTarget) return null;

    const decimal = Math.min(1, questProgress / questTarget);

    return args.percentCompleteText !== undefined
        ? { percentComplete: decimal, percentCompleteText: `${Math.floor(decimal * 100)}%` }
        : { percentComplete: decimal };
}
