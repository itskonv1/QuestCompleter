/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuestTaskType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findLazy } from "@webpack";
import { FluxDispatcher, QuestStore, RestAPI, showToast, Toasts } from "@webpack/common";

import { getQuestProgress,getQuestTarget, getQuestTask } from "./helpers";
import { settings } from "./settings";

interface QuestEnrollmentMetadata {
    questContent: unknown;
    questContentCTA?: string;
    sourceQuestContent: unknown;
    sourceQuestContentCTA?: string;
    questContentPosition: unknown;
    questContentRowIndex: unknown;
}

interface QuestCTAConstants {
    START_QUEST: string;
    ACCEPT_QUEST: string;
}

type HeartbeatDispatchResult =
    | { type: "success"; userStatus: any; }
    | { type: "failure"; error: unknown; }
    | { type: "timeout"; };

interface HeartbeatDispatchWaiter {
    promise: Promise<HeartbeatDispatchResult>;
    cancel: () => void;
}

const reportVideoProgress = findByCodeLazy(".QUESTS_VIDEO_PROGRESS(") as (questId: string, progress: number) => Promise<void>;

const sendHeartbeat = findByCodeLazy(".QUESTS_HEARTBEAT(") as (options: {
    questId: string;
    streamKey?: string;
    applicationId: string;
    terminal?: boolean;
    executableFingerprint?: unknown;
}) => Promise<void>;

const getApplicationProxyTicket = findByCodeLazy("APPLICATION_PROXY_TICKET", "body.ticket") as (applicationId: string, channelId?: string) => Promise<string>;

export const enrollInQuest = findByCodeLazy('type:"QUESTS_ENROLL_BEGIN",') as (questId: string, options: QuestEnrollmentMetadata) => Promise<{ type: string; }>;

const QuestCTA = findLazy(m => !!m?.START_QUEST && !!m?.ACCEPT_QUEST) as QuestCTAConstants;

function resolveQuestCTA(taskType?: QuestTaskType): string | undefined {
    if (!taskType) return undefined;
    return [QuestTaskType.ACHIEVEMENT_IN_ACTIVITY, QuestTaskType.PLAY_ACTIVITY, QuestTaskType.WATCH_VIDEO].includes(taskType)
        ? QuestCTA.START_QUEST
        : QuestCTA.ACCEPT_QUEST;
}

async function getActivityReferrer(appId: string): Promise<string | undefined> {
    try {
        const proxyTicket = await getApplicationProxyTicket(appId);
        const referrer = new URL(`https://${appId}.discordsays.com/`);
        referrer.searchParams.set("instance_id", "example-cl-instance");
        referrer.searchParams.set("platform", "desktop");
        referrer.searchParams.set("discord_proxy_ticket", proxyTicket);
        return referrer.toString();
    } catch (error) {
        if (settings.store.debugMode) {
            console.error("[QuestCompleter] Failed to get referrer for", appId, error);
        }
    }
}

function makeEnrollmentData(quest: any, taskType?: QuestTaskType): QuestEnrollmentMetadata {
    return {
        questContent: 1,
        questContentCTA: resolveQuestCTA(taskType),
        sourceQuestContent: 1,
        sourceQuestContentCTA: resolveQuestCTA(taskType),
        questContentPosition: 1,
        questContentRowIndex: 1
    };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
        return Promise.reject(new Error("Aborted"));
    }
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);

        function onAbort() {
            clearTimeout(timeoutId);
            signal?.removeEventListener("abort", onAbort);
            reject(new Error("Aborted"));
        }
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

function waitForHeartbeatDispatchResult(questId: string, timeoutMs: number): HeartbeatDispatchWaiter {
    let settled = false;
    let cleanup = () => {};
    const promise = new Promise<HeartbeatDispatchResult>(resolve => {
        const successEvent = "QUESTS_SEND_HEARTBEAT_SUCCESS";
        const failureEvent = "QUESTS_SEND_HEARTBEAT_FAILURE";
        const timeoutId = setTimeout(() => {
            cleanup();
            resolve({ type: "timeout" });
        }, timeoutMs);

        cleanup = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            FluxDispatcher.unsubscribe(successEvent, onSuccess);
            FluxDispatcher.unsubscribe(failureEvent, onFailure);
        };

        function onSuccess(data: { questId?: string; userStatus?: any; }) {
            if (data.questId !== questId) return;
            cleanup();
            resolve({ type: "success", userStatus: data.userStatus ?? null });
        }

        function onFailure(data: { questId?: string; error?: unknown; }) {
            if (data.questId !== questId) return;
            cleanup();
            resolve({ type: "failure", error: data.error });
        }

        FluxDispatcher.subscribe(successEvent, onSuccess);
        FluxDispatcher.subscribe(failureEvent, onFailure);
    });

    return { promise, cancel: cleanup };
}

export class QuestRunner {
    private readonly abortController = new AbortController();
    private activeIntervals: ReturnType<typeof setInterval>[] = [];

    constructor(
        public readonly questId: string,
        private readonly quest: any
    ) {}

    public cancel(): void {
        this.abortController.abort();
        for (const interval of this.activeIntervals) {
            clearInterval(interval);
        }
        this.activeIntervals = [];
    }

    public async run(): Promise<void> {
        try {
            const task = getQuestTask(this.quest);
            if (!task) return;

            if (!this.quest.userStatus?.enrolledAt) {
                if (!settings.store.autoStart) return;

                if (settings.store.showNotifications) {
                    showToast(`Enrolling in ${this.quest.config.messages.questName}...`, Toasts.Type.MESSAGE);
                }

                const res = await enrollInQuest(this.questId, makeEnrollmentData(this.quest, task.type));
                if (this.abortController.signal.aborted) return;
                if (!res || (res.type !== "success" && (res as any).type !== "previous_in_flight_request")) {
                    return;
                }
            }

            const targets = getQuestTarget(task, settings.store.completeVideoQuestsQuicker);
            const initialProgress = getQuestProgress(this.quest, task);

            if (task.type === QuestTaskType.WATCH_VIDEO || task.type === QuestTaskType.WATCH_VIDEO_ON_MOBILE) {
                await this.runVideoQuest(task, targets, initialProgress);
            } else if (task.type === QuestTaskType.ACHIEVEMENT_IN_ACTIVITY) {
                await this.runAchievementQuest(task, targets.adjusted);
            } else {
                await this.runPlayQuest(task, targets.adjusted, initialProgress);
            }

            if (this.abortController.signal.aborted) return;

            if (settings.store.showNotifications) {
                showToast(`Completed: ${this.quest.config.messages.questName}`, Toasts.Type.SUCCESS);
            }

            if (settings.store.autoClaim) {
                await sleep(2000, this.abortController.signal);
                const platforms = this.quest.config?.rewardsConfig?.platforms ?? [];
                const platform = platforms.includes(4) ? 4 : (platforms[0] ?? 0);
                await RestAPI.post({
                    url: `/quests/${this.questId}/claim-reward`,
                    body: { platform, location: 1 },
                    signal: this.abortController.signal
                } as any);

                if (settings.store.showNotifications) {
                    showToast(`Reward claimed: ${this.quest.config.messages.questName}`, Toasts.Type.SUCCESS);
                }
            }
        } catch (error: any) {
            if (settings.store.debugMode && !this.abortController.signal.aborted) {
                console.error("[QuestCompleter] Runner error for", this.questId, error);
                console.error("[QuestCompleter] Quest rewards config:", JSON.stringify(this.quest.config?.rewardsConfig));
                if (error instanceof Error) {
                    console.error(error.stack);
                } else if (typeof error === "object" && error !== null) {
                    console.error("[QuestCompleter] API error detail:", {
                        status: error.status,
                        body: error.body,
                        text: error.text,
                        message: error.message
                    });
                } else {
                    console.error("[QuestCompleter] Raw error:", error);
                }
            }
        } finally {
            for (const interval of this.activeIntervals) {
                clearInterval(interval);
            }
            this.activeIntervals = [];
        }
    }

    private async runVideoQuest(task: any, targets: { raw: number; adjusted: number; }, initialProgress: number): Promise<void> {
        const enrolledAtStr = this.quest.userStatus?.enrolledAt;
        const enrolledAt = enrolledAtStr ? new Date(enrolledAtStr) : null;

        const reportTarget = targets.raw;
        const completionTarget = targets.adjusted;

        const effectiveProgress = settings.store.completeVideoQuestsQuicker && enrolledAt
            ? Math.max(1, (Date.now() - enrolledAt.getTime()) / 1000)
            : initialProgress;

        let currentProgress = Math.min(completionTarget, effectiveProgress);
        let reportedProgress = Math.min(reportTarget, effectiveProgress);

        if (currentProgress >= completionTarget) {
            await reportVideoProgress(this.questId, Math.floor(reportTarget));
            return;
        }

        await reportVideoProgress(this.questId, Math.floor(reportedProgress));

        const timeRemaining = completionTarget - currentProgress;
        const progressToCover = reportTarget - reportedProgress;
        const speedFactor = timeRemaining > 0 ? progressToCover / timeRemaining : 1;

        const interval = setInterval(() => {
            currentProgress = Math.min(completionTarget, currentProgress + 1);
            reportedProgress = Math.min(reportTarget, reportedProgress + speedFactor);
        }, 1000);
        this.activeIntervals.push(interval);

        let lastReported = Math.floor(reportedProgress);
        while (currentProgress < completionTarget && !this.abortController.signal.aborted) {
            await sleep(5000, this.abortController.signal);
            const toReport = Math.floor(reportedProgress);
            if (toReport > lastReported) {
                await reportVideoProgress(this.questId, toReport);
                lastReported = toReport;
            }
        }

        if (currentProgress >= completionTarget && !this.abortController.signal.aborted) {
            await reportVideoProgress(this.questId, Math.floor(reportTarget));
        }
    }

    private async runPlayQuest(task: any, target: number, initialProgress: number): Promise<void> {
        let currentProgress = initialProgress;
        const streamKey = task.type === QuestTaskType.STREAM_ON_DESKTOP ? `call:${this.questId}:1` : undefined;
        const appId = task.applications?.[0]?.id ?? this.quest.config?.application?.id;
        if (!appId) return;

        const interval = setInterval(() => {
            currentProgress = Math.min(target, currentProgress + 1);
        }, 1000);
        this.activeIntervals.push(interval);

        let heartbeat = await this.reportPlayProgress(task, appId, streamKey, false);
        if (heartbeat.progress !== null) {
            currentProgress = Math.max(currentProgress, heartbeat.progress);
        }

        while (currentProgress < target && !this.abortController.signal.aborted && !heartbeat.completed) {
            const nextSleep = Math.min(61000, Math.max(5000, (target - currentProgress) * 1000 + 1000));
            await sleep(nextSleep, this.abortController.signal);

            heartbeat = await this.reportPlayProgress(task, appId, streamKey, currentProgress >= target);
            if (heartbeat.progress !== null) {
                currentProgress = Math.max(currentProgress, heartbeat.progress);
            }
        }

        if (currentProgress >= target || heartbeat.completed) {
            await this.reportPlayProgress(task, appId, streamKey, true);
        }
    }

    private async reportPlayProgress(task: any, appId: string, streamKey: string | undefined, terminal: boolean): Promise<{ progress: number | null; completed: boolean; }> {
        const waiter = waitForHeartbeatDispatchResult(this.questId, 15000);
        try {
            await sendHeartbeat({
                questId: this.questId,
                streamKey,
                applicationId: appId,
                terminal
            });
            const res = await waiter.promise;
            if (res.type === "success") {
                const updatedQuest = QuestStore.getQuest(this.questId);
                const progressVal = res.userStatus?.progress?.[task.type]?.value
                    ?? (updatedQuest ? getQuestProgress(updatedQuest, task) : null)
                    ?? 0;
                return {
                    progress: progressVal,
                    completed: !!res.userStatus?.completedAt || (updatedQuest ? !!updatedQuest.userStatus?.completedAt : false)
                };
            }
        } catch (e) {
            waiter.cancel();
        }
        return { progress: null, completed: false };
    }

    private async runAchievementQuest(task: any, target: number): Promise<void> {
        const appId = task.applications?.[0]?.id;
        if (!appId) return;

        let authCode: string | null = null;
        try {
            const response = await RestAPI.post({
                url: `/oauth2/authorize?client_id=${appId}&response_type=code&scope=identify%20applications.entitlements&state=`,
                body: { authorize: true }
            } as any);
            const location = (response as any)?.body?.location || (response as any)?.location;
            authCode = location ? new URL(location).searchParams.get("code") : null;
        } catch (error) {
            if (settings.store.debugMode) {
                console.error("[QuestCompleter] Achievement auth failed for client id", appId, error);
            }
            return;
        }

        if (!authCode) return;

        const Native = VencordNative?.pluginHelpers?.QuestCompleter as any;
        if (!Native?.complete) {
            if (settings.store.debugMode) {
                console.error("[QuestCompleter] Native helper QuestCompleter/complete missing");
            }
            return;
        }

        const referrer = await getActivityReferrer(appId);
        const result = await Native.complete(appId, authCode, target, this.questId, referrer);
        if (result?.success) {
            await sleep(2000, this.abortController.signal);
        }
    }
}

export class QuestOrchestrator {
    private runners = new Map<string, QuestRunner>();
    private pendingTimeouts = new Set<NodeJS.Timeout>();

    public syncQuests(quests: any[]): void {
        for (const timeoutId of this.pendingTimeouts) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.clear();

        const activeQuests = quests.filter(q => this.shouldProcess(q));
        let delayMs = 0;

        for (const quest of activeQuests) {
            if (!this.runners.has(quest.id)) {
                const questId = quest.id;
                const timeoutId = setTimeout(() => {
                    this.pendingTimeouts.delete(timeoutId);
                    const freshQuest = QuestStore.getQuest(questId);
                    if (freshQuest && this.shouldProcess(freshQuest) && !this.runners.has(questId)) {
                        const runner = new QuestRunner(questId, freshQuest);
                        this.runners.set(questId, runner);
                        runner.run().finally(() => {
                            if (this.runners.get(questId) === runner) {
                                this.runners.delete(questId);
                            }
                        });
                    }
                }, delayMs);
                this.pendingTimeouts.add(timeoutId);
                delayMs += 2500;
            }
        }

        const activeIds = new Set(activeQuests.map(q => q.id));
        for (const [id, runner] of this.runners.entries()) {
            if (!activeIds.has(id)) {
                runner.cancel();
                this.runners.delete(id);
            }
        }
    }

    private shouldProcess(quest: any): boolean {
        if (!quest.config) return false;
        if (quest.userStatus?.completedAt) return false;
        if (new Date(quest.config.expiresAt).getTime() <= Date.now()) return false;
        const task = getQuestTask(quest);
        if (!task) return false;
        if (!quest.userStatus?.enrolledAt && !settings.store.autoStart) return false;
        return true;
    }

    public stopAll(): void {
        for (const timeoutId of this.pendingTimeouts) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.clear();
        for (const runner of this.runners.values()) {
            runner.cancel();
        }
        this.runners.clear();
    }
}
