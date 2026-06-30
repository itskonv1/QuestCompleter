# QuestCompleter

A custom plugin for Vencord and Equicord that automates completing Discord Quests and claiming their rewards.
It interacts with Discord's internal action creators to progress video, game, and achievement quests.

---

## Installation

### Method 1: Via Equicord Client UI (Easiest)

If you are using the Equicord client, you can install the plugin directly from the settings:

1. Open your Discord Settings.
2. Go to **UserPlugins** under the Equicord Settings section in the sidebar.
3. Paste the repository URL into the **Install Plugin** input box:
   ```text
   https://github.com/itskonv1/QuestCompleter.git
   ```
4. Click **Install**.
5. Find **QuestCompleter** in the list and toggle the switch to enable it.

### Method 2: Manual Installation (For Developers / Vencord and Equicord)

If you compile Vencord or Equicord from source:

1. Open your terminal in the root folder of your Vencord or Equicord repository clone.
2. Clone this repository into the `src/userplugins` folder:
   ```bash
   git clone https://github.com/itskonv1/QuestCompleter.git src/userplugins/QuestCompleter
   ```
3. Rebuild the bundle and patch your Discord installation:
   ```bash
   pnpm build --dev
   pnpm inject
   ```
4. Fully restart Discord (make sure to close it from your system tray or task manager, then reopen).
5. Open your settings, go to the Plugins section, search for **QuestCompleter**, and enable it.

---

## Features

- **Auto-Enrollment**: Automatically accepts new quests when they are released.
- **Auto-Claim**: Automatically claims your gift codes, decorations, or orbs as soon as the progress is complete.
- **Quicker Video Completion**: If you enrolled in a video quest in the past, the plugin skips the playback timer and registers 100% progress instantly.
- **Background Progression**: Reports play and streaming quest updates in the background without keeping the target game open.
- **Achievement Helper**: Utilizes a native main-process IPC handler to bypass renderer-level Content Security Policies (CSP) and unlock achievement-based quests.

---

## Configuration Settings

| Setting | Description | Recommended |
| --- | --- | --- |
| **Auto-Enroll** | Accept new quests automatically. | On |
| **Auto-Claim** | Redeem codes or decorations immediately on completion. | On |
| **Show Notifications** | Display client toast updates for quest events. | On |
| **Complete Video Quests Quicker** | Skip watch timers using elapsed enrollment time. | On |
| **Make Mobile Video Quests Compatible** | Watch mobile-only video quests on your desktop client. | On |
| **Debug Mode** | Print detailed API progression and responses to the console. | Off |
