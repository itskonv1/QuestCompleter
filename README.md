<h1 align="center">QuestCompleter</h1>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=111111&height=200&section=header&text=QuestCompleter&fontSize=60&fontColor=ffffff" width="100%" alt="QuestCompleter Header">
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com/?font=Righteous&size=24&color=888888&center=true&vCenter=true&width=600&height=50&duration=3000&lines=Automate+Discord+Quests+In+The+Background;Accept+New+Quests+Automatically;Claim+Decorations+And+Orbs+Instantly" alt="Typing"/>
</p>

<p align="center">
  <a href="https://github.com/itskonv1/QuestCompleter/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-GPL--3.0-black?style=for-the-badge" alt="License: GPL-3.0">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Compatibility-Vencord%20%7C%20Equicord-lightgrey?style=for-the-badge" alt="Compatibility">
  </a>
</p>

<p align="center">
  <b>A Vencord and Equicord user plugin that handles Discord Quests automatically in the background. No more idling in random games or waiting for video timers.</b>
</p>

---

<h2 align="center">
  <img src="https://img.icons8.com/?size=100&id=YSWCDCSF4H3N&format=png&color=888888" width="22"> Features
</h2>

```text
QuestCompleter Features:
• Auto-Enroll   : Accepts new quests as soon as they drop
• Auto-Claim    : Redeems gift codes, profile decorations, or Orbs instantly
• Play in BG    : Progresses game/stream quests without keeping games running
• Skip Timers   : Bypasses playback wait times on video quests
• IPC Bridge    : Solves achievement-based quests by bypassing renderer CSP limits
• Mobile Mode   : Watch and complete mobile-only video quests on desktop
• Toast Alerts  : Keeps you notified whenever a quest updates or completes
```

---

<h2 align="center">
  <img src="https://img.icons8.com/?size=100&id=YSWCDCSF4H3N&format=png&color=888888" width="22"> Installation
</h2>

### Method 1: One-Command Setup (Full Equicord & Plugin Installation)

If you do not have Equicord installed yet, this single command handles the entire setup (clones Equicord, sets up this plugin, installs dependencies, builds, and injects):

```bash
curl -sSL https://raw.githubusercontent.com/itskonv1/QuestCompleter/main/install.sh | bash
```

> [!IMPORTANT]
> Make sure to completely restart Discord (close it from system tray or task manager, then reopen) once the script completes.

---

### Method 2: Manual Installation

If you already have a Vencord or Equicord repository clone:

1. Clone this repository into your `src/userplugins` directory:
   ```bash
   git clone https://github.com/itskonv1/QuestCompleter.git src/userplugins/QuestCompleter
   ```
2. Install dependencies, build, and inject:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm inject
   ```
3. Restart Discord completely, open settings, and toggle **QuestCompleter** under the **UserPlugins** section.

---

<h2 align="center">
  <img src="https://img.icons8.com/?size=100&id=YSWCDCSF4H3N&format=png&color=888888" width="22"> Settings Configuration
</h2>

You can customize the plugin's behavior under Settings → Plugins → UserPlugins:

```text
Plugin Settings:
• Auto-Enroll                           : Enabled (Accept quests)
• Auto-Claim                            : Enabled (Claim rewards)
• Show Notifications                    : Enabled (Client toasts)
• Complete Video Quests Quicker         : Enabled (Skip video timers)
• Make Mobile Video Quests Compatible   : Enabled (Watch mobile quests)
• Debug Mode                            : Disabled (Log progression)
```

---

<br>

<p align="center">
  Developed by <b>@kon</b>.
  <br><br>
  If you find a bug, have an idea, or want to contribute, feel free to open an issue or submit a pull request.
</p>
