# Customer Journey Quest — Standalone Desktop Quiz & Admin Suite

A complete, fully functional, and portable enterprise offline PC quiz application with a dedicated, completely decoupled **Admin Portal** and local network **Synchronization Engine**.

Faithfully designed after the **Customer Journey Quest** aesthetic (*Interactive Department Experience: From first click to lifetime trust*), packaged into standalone native Windows executables (`.exe`) that require **zero Node.js, zero browser configuration, zero internet access, and zero external runtime dependencies**.

---

## 📦 What Was Built: Architecture Overview

The system is separated into **two independent applications** plus a lightweight **synchronization service**:

```
Game-K/
├── Launch-Game.bat                     <-- 1-Click launcher for Player Game
├── Launch-Admin-Portal.bat             <-- 1-Click launcher for Admin Portal
├── Start-Sync-Server.bat               <-- Optional local synchronization daemon (Port 4820)
├── Build-Standalone-Distributables.bat <-- Generates clean portable USB-ready packages
│
├── release/
│   ├── CustomerJourneyQuest-Game-Standalone/
│   │   ├── CustomerJourneyQuest-Game.exe  <-- Portable offline game binary (No Node/Browser needed)
│   │   ├── Run.bat                        <-- Alternative launcher
│   │   └── resources/app/                 <-- Bundled assets & pre-seeded offline database
│   │
│   └── CustomerJourneyQuest-Admin-Standalone/
│       ├── CustomerJourneyQuest-Admin.exe <-- Portable Admin Portal binary (PIN: admin123)
│       ├── Run.bat                        <-- Alternative launcher
│       └── resources/app/                 <-- Dedicated admin bundle with Question Bank & Sync
│
└── server/
    └── sync-server.cjs                    <-- Zero-dependency HTTP sync engine (persists sync-data.json)
```

---

## ⚡ Quick Start: Running the Applications

### Option 1: Double-Click the Windows Launchers (Recommended)
- **To play the game**: Double-click `Launch-Game.bat` (or open `release\CustomerJourneyQuest-Game-Standalone\CustomerJourneyQuest-Game.exe`).
- **To manage questions & settings**: Double-click `Launch-Admin-Portal.bat` (or open `release\CustomerJourneyQuest-Admin-Standalone\CustomerJourneyQuest-Admin.exe`). Default Admin PIN: `admin123`.
- **To enable LAN/Multi-Device Synchronization**: Double-click `Start-Sync-Server.bat`.

### Option 2: Copy to USB for Instant Offline Execution on Any PC
1. Copy the entire folder `release\CustomerJourneyQuest-Game-Standalone` to your USB drive.
2. Plug the USB into any Windows 10/11 computer (even an air-gapped machine with no internet and no developer tools).
3. Double-click `CustomerJourneyQuest-Game.exe`. The game runs instantly with full audio, persistent local storage, and bundled default questions.

---

## 🎮 1. Standalone Game Application (`CustomerJourneyQuest-Game.exe`)

### 🛡️ Complete Admin Decoupling
- **Zero Admin Buttons or Links**: There are no admin buttons, login modals, or administrative navigation routes anywhere in the player game. The player can never access administrative tools.
- **Dedicated Independent Entry Point**: The player application loads strictly `index.html` bundled with player-facing runtime code.

### ⚖️ Fair Competition Mode & Absolute Answer Secrecy
Built specifically for live competitions, hackathons, and corporate assessments:
1. **Neutral Feedback During Gameplay**: When a player selects an answer choice, the game does **not** reveal whether the choice was correct or incorrect (no green/red color highlighting, no immediate scoring clues). It displays a clean, neutral confirmation: *"Response recorded"*.
2. **Hidden Running Score**: To prevent onlookers and adjacent competitors from gauging answers in real time, the running score is concealed during active question answering.
3. **Mandatory 30-Second Question Deadline**:
   - Each question has an independent 30-second countdown timer.
   - Timer calculation uses high-resolution monotonic timestamps (`performance.now()`), remaining strictly accurate even under CPU throttling.
   - Visual warnings: Mint (`>10s`), Amber (`≤10s`), Pulsing Crimson (`≤5s`) with audio warnings.
   - If time expires (0s), the question is recorded as **unanswered**, inputs lock immediately, and the game moves forward without revealing what the correct answer was.
4. **End-of-Game Audit Summary (Without Disclosing Answer Keys)**:
   - At the conclusion of the quest, the final score, accuracy percentage, and leaderboard ranking are revealed.
   - The question summary breakdown displays the Question Number, Question Text, the Player's Submitted Choice, and a clean `✓` (correct) or `✗` (incorrect / timed out).
   - **Answer Secrecy Preserved**: The actual correct answer key is **never** disclosed in the player summary, preserving test integrity for subsequent competitors.
5. **Runtime Payload Sanitization**: Correct answer keys and explanatory texts are stripped from runtime question objects before being handed to the game view. Scoring is computed securely upon final game completion.

### 🏆 Persistent Local Leaderboard
- Tracks player records across all attempts using local **IndexedDB**.
- Tie-breaking rules:
  1. Highest final score
  2. Higher number of correct answers
  3. Faster total completion time (seconds)
  4. Earliest completion timestamp
- Features views for **Overall All-Time**, **Today's Leaderboard**, and **Personal Bests**.

---

## ⚙️ 2. Separate Admin Portal (`CustomerJourneyQuest-Admin.exe`)

A dedicated administrative application running independently with full management features:
- **Default Login Password**: `admin123` (editable in Admin Account Settings).
- **Question Management**:
  - Add, edit, duplicate, and delete questions with confirmation modals.
  - Category management (Marketing, PreSales, Proposals, Guardian, Digital).
  - Workflow status: `Published`, `Draft`, `Disabled`.
  - Preview questions before publishing.
  - In-app duplicate question detection.
- **Game Configuration**:
  - Timer duration per question (seconds).
  - Questions per session (e.g. 5, 10, or all available).
  - Shuffle questions and shuffle answer choices toggles.
  - Enable/disable negative scoring.
- **Session Audits & Leaderboard Reset**:
  - Full player session audit with per-question player answer, score awarded, and response duration.
  - **Reset / Clear Leaderboard**: Dedicated one-click button in both the Records tab and Settings tab with safety confirmation modal to wipe all past player scores, history, and rankings locally and on the sync server.
  - CSV export of player rankings and audit records.
- **Universal Import / Export & Backup**:
  - **Multi-Format Question Importer**: Supports **Excel (`.xlsx`, `.xls`)**, **Word (`.docx`, `.doc`)**, **PDF (`.pdf`)**, and standard **CSV/text** files with automatic question/option extraction and syntax validation.
  - Previews extracted valid questions and flags formatting issues before committing.
  - Export question bank to CSV or JSON.
  - Full system backup & restore (`.json`).
- **Publish & Broadcast**:
  - A prominent **"Publish to Game Clients"** button increments the question revision counter and broadcasts the update to the synchronization server.

---

## 🔄 3. Synchronization Architecture (Offline-First)

Both applications are engineered with an **offline-first resilience model**:

```
[ Admin Portal ]
      │ (Publishes new revision)
      ▼
[ Sync Server (Port 4820) ] ◄── Local JSON store (server/data/sync-data.json)
      ▲
      │ (Polls revisions & flushes session records)
[ Game Client 1 ]   [ Game Client 2 ]   [ Game Client N ]
```

1. **Standalone Offline Play**:
   - The Game Application always runs 100% offline using its local cache and bundled question bank.
   - If the sync server is offline, the game never blocks, never freezes, and never errors.
2. **Background Heartbeat & Discovery**:
   - When opened, both applications perform non-blocking background heartbeat checks to `http://localhost:4820/api/status` (configurable to LAN IP in Admin -> Sync & Deploy).
   - The UI shows live connection badges: **Online (Sync Active)** or **Offline Mode (Local Cache Active)**.
3. **Automatic Cache Invalidation & Publishing**:
   - When an administrator modifies questions and clicks **"Publish to Game Clients"**, the sync server stores the newest version revision (e.g. `rev-2`, `rev-3`).
   - Game clients detect newer server revisions in the background, update their local cache, and apply the updated question bank for all subsequent game sessions.
4. **Session Queue & Reconnection Flushing**:
   - Completed game sessions are saved to local IndexedDB immediately.
   - If offline, sessions are added to an outbound sync queue.
   - As soon as connectivity to the sync server is restored, all queued sessions are automatically pushed to the sync server without duplication, merging into the master leaderboard.

---

## 🔨 How to Rebuild Standalone Packages

To recompile after modifying code:
1. Double-click `Build-Standalone-Distributables.bat`, or run from PowerShell:
   ```powershell
   npm run build
   node scripts/package-standalone.cjs
   ```
2. The script compiles the production bundles into `dist/` and packages clean standalone directories into `release\`:
   - `release\CustomerJourneyQuest-Game-Standalone`
   - `release\CustomerJourneyQuest-Admin-Standalone`

---

## 📋 Technology Stack
- **Desktop Runtime**: Electron 40 (Bundled standalone portable runtime)
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS, Lucide Icons
- **Local Persistence**: IndexedDB (`CustomerJourneyQuestDB` & `CustomerJourneyQuestAdminDB`)
- **Sound System**: Synthesized Web Audio API (zero external audio dependencies)
- **Sync Server**: Lightweight Node.js HTTP service (zero npm dependencies, pure native `http` module)
