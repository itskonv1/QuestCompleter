/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { NavigationRouter, QuestStore,React } from "@webpack/common";

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

const GuildlessServerListItemComponent = findComponentByCodeLazy("tooltip:", "asContainer:");

function QuestIcon({ height, width, className }: { height: number; width: number; className?: string; }): React.JSX.Element {
    return (
        <svg viewBox="0 0 24 24" height={height} width={width} fill="none" className={className}>
            <path fill="currentColor" d="M7.5 21.7a8.95 8.95 0 0 1 9 0 1 1 0 0 0 1-1.73c-.6-.35-1.24-.64-1.9-.87.54-.3 1.05-.65 1.52-1.07a3.98 3.98 0 0 0 5.49-1.8.77.77 0 0 0-.24-.95 3.98 3.98 0 0 0-2.02-.76A4 4 0 0 0 23 10.47a.76.76 0 0 0-.71-.71 4.06 4.06 0 0 0-1.6.22 3.99 3.99 0 0 0 .54-5.35.77.77 0 0 0-.95-.24c-.75.36-1.37.95-1.77 1.67V6a4 4 0 0 0-4.9-3.9.77.77 0 0 0-.6.72 4 4 0 0 0 3.7 4.17c.89 1.3 1.3 2.95 1.3 4.51 0 3.66-2.75 6.5-6 6.5s-6-2.84-6-6.5c0-1.56.41-3.21 1.3-4.51A4 4 0 0 0 11 2.82a.77.77 0 0 0-.6-.72 4.01 4.01 0 0 0-4.9 3.96A4.02 4.02 0 0 0 3.73 4.4a.77.77 0 0 0-.95.24 3.98 3.98 0 0 0 .55 5.35 4 4 0 0 0-1.6-.22.76.76 0 0 0-.72.71l-.01.28a4 4 0 0 0 2.65 3.77c-.75.06-1.45.33-2.02.76-.3.22-.4.62-.24.95a4 4 0 0 0 5.49 1.8c.47.42.98.78 1.53 1.07-.67.23-1.3.52-1.91.87a1 1 0 1 0 1 1.73Z" />
        </svg>
    );
}

function QuestButtonRenderer(): React.JSX.Element {
    const handleQuestClick = (e: React.MouseEvent) => {
        if ((e.nativeEvent as MouseEvent).type === "mousedown" && (e.nativeEvent as MouseEvent).button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        NavigationRouter.transitionTo("/quest-home");
    };

    return (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <GuildlessServerListItemComponent
                icon={() => <QuestIcon height={26} width={26} />}
                tooltip="Quests"
                onClick={handleQuestClick}
                onMouseDown={handleQuestClick}
            />
        </div>
    );
}

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

    renderQuestifyButton: ErrorBoundary.wrap(QuestButtonRenderer, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderQuestifyButton);
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
                match: /(let{percentComplete:.{0,115}?children:\i}=)(\i)/,
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
        removeServerListElement(ServerListRenderPosition.Above, this.renderQuestifyButton);
        if (orchestrator) {
            orchestrator.stopAll();
            orchestrator = null;
        }
    }
});
