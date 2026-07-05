/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import definePlugin from "@utils/types";
import { QuestStore } from "@webpack/common";

import { QuestOrchestrator } from "./completion";
import {
    getQuestAcceptedButtonText,
    getQuestPanelPercentComplete,
    getQuestTileClasses,
    getQuestTileStyle,
    getQuestUnacceptedButtonText,
    injectDesktopVideoQuestTasks
} from "./helpers";
import { settings } from "./settings";

let orchestrator: QuestOrchestrator | null = null;
let updateTimeoutId: ReturnType<typeof setTimeout> | undefined;

function handleQuestsUpdate(): void {
    if (!orchestrator) return;
    const questsMap = QuestStore?.quests;
    if (!(questsMap instanceof Map)) return;
    const raw = Array.from(questsMap.values());
    if (settings.store.makeMobileVideoQuestsDesktopCompatible) {
        injectDesktopVideoQuestTasks(raw);
    }
    orchestrator.syncQuests(raw);
}

function debouncedUpdate(): void {
    clearTimeout(updateTimeoutId);
    updateTimeoutId = setTimeout(handleQuestsUpdate, 500);
}

export default definePlugin({
    name: "QuestCompleter",
    description: "Autocompletes Discord quests safely using official action creators",
    authors: [{ id: 1128391811136770128n, name: "Y4M1X" }],
    tags: ["Activity", "Utility", "Customisation"],

    settings,

    getQuestTileStyle,
    getQuestTileClasses,
    getQuestUnacceptedButtonText,
    getQuestAcceptedButtonText,
    getQuestPanelPercentComplete,

    flux: {
        QUESTS_FETCH_CURRENT_QUESTS_SUCCESS: debouncedUpdate,
        QUESTS_ENROLL_SUCCESS: debouncedUpdate,
        QUESTS_USER_STATUS_UPDATE: debouncedUpdate,
        QUEST_CLAIM: debouncedUpdate
    },

    start() {
        orchestrator = new QuestOrchestrator();
        debouncedUpdate();
    },

    patches: [
        {
            find: "IN_PROGRESS:if(",
            group: true,
            replacement: [
                {
                    match: /(\i,tooltipText:null,onClick:async\(\)=>{)/,
                    replace: "$self.getQuestUnacceptedButtonText(arguments[0].quest)??$1"
                },
                {
                    match: /(if\(\i\)return{text:)/,
                    replace: "$1$self.getQuestAcceptedButtonText(arguments[0].quest)??"
                }
            ]
        },
        {
            find: '"primary",preClickCallback:',
            replacement: [
                {
                    match: /(?=let{quest:)/,
                    replace: "const questifyText=$self.getQuestUnacceptedButtonText(arguments[0].quest);"
                },
                {
                    match: /(?<=,text:)(\i),icon:\i/,
                    replace: "questifyText??$1"
                }
            ]
        },
        {
            find: "id:`quest-tile-",
            group: true,
            replacement: [
                {
                    match: /(?<=\i.current=\i},className:)(\i\(\)\(\i.\i,\i.\i\)),/,
                    replace: "$self.getQuestTileClasses($1,arguments[0].quest),style:$self.getQuestTileStyle(arguments[0].quest),"
                }
            ]
        },
        {
            find: ",{progressTextAnimation:",
            replacement: {
                match: /(let{percentComplete:.{0,115}?children:\i,useAltStyle:\i=!1}=)(\i)/,
                replace: "const questifyProgress=$self.getQuestPanelPercentComplete({...$2,quest:$2.children?.props?.quest});$1Object.assign({},$2,questifyProgress??{})"
            }
        },
        {
            find: "NetworkActionNames.QUEST_VIDEO_PROGRESS,",
            group: true,
            replacement: [
                {
                    match: /(async function \i\(\i,\i\)\{await \i\.\i\.post\(\{url:\i\.\i\.QUESTS_VIDEO_PROGRESS.{0,250}?stack_trace:)Error\(\)\.stack\?\?""/,
                    replace: '$1""'
                },
                {
                    match: /(async function \i\(\i\)\{let\{questId:\i,streamKey:\i.{0,450}?stack_trace:)Error\(\)\.stack\?\?""/,
                    replace: '$1""'
                }
            ]
        }
    ],

    stop() {
        clearTimeout(updateTimeoutId);
        updateTimeoutId = undefined;
        if (orchestrator) {
            orchestrator.stopAll();
            orchestrator = null;
        }
    }
});
