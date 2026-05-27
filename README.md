# FieldSync — Remote Expert Platform

> Connect factory floor workers with certified machine experts in real time — with live 3D guidance, shared markers, and instant voice communication.

---

## What is FieldSync?

FieldSync is a real-time remote assistance platform designed for industrial environments. When a factory worker encounters a problem with a machine, they launch an SOS call and are instantly connected with a certified expert who guides them through the fix — **inside a live, shared 3D model of the exact machine**.

### Core Capabilities

| Feature | Description |
|---|---|
| **SOS Call Flow** | Worker selects the broken machine, optionally enters their location (dept / line / station), and is matched with an available certified expert in seconds |
| **Live 3D Viewer** | Both sides see the same Matterport 3D model of the machine simultaneously — experts place markers, draw laser pointers, and highlight zones directly on the model |
| **Smart Deflection** | Before escalating, workers see AI-matched solutions from past sessions for the same machine — they can replay historical markers in 3D to self-solve |
| **Bi-directional PTT** | Push-to-talk voice with live speech-to-text — both expert and worker can speak; transcripts are saved to the session record |
| **Mirror View** | Expert controls who drives the 3D camera — lock to their view, give the worker control, or let the worker request control independently |
| **Step-by-step Playbooks** | Experts send structured repair playbooks; workers confirm each step or request clarification |
| **Emergency Freeze** | One-click safety stop that freezes the worker's view and broadcasts a full-screen warning |
| **Session History** | Workers review every past call — markers placed, instructions given, voice count, and movement breadcrumb through the 3D space |
| **Administrator Dashboard** | Full session audit log across all workers and machines, with delete capability and 3D marker preview for any session |
| **4 Roles** | Worker · Expert · Administrator — each with dedicated onboarding and dashboard |

---

## Quick Start — One Command

### Prerequisites

- **Node.js** 18 or later → [nodejs.org](https://nodejs.org)
- **Git** → [git-scm.com](https://git-scm.com)

### 1. Clone, install, and launch

```bash
git clone https://github.com/moramaa/remote-expert-app.git && cd remote-expert-app && npm install && npx prisma migrate dev --name init && npm run db:seed && npm run dev
```

That's it. The app will be running at **[http://localhost:3000](http://localhost:3000)**.

> **What this does:**
> 1. Clones the repository
> 2. Installs all dependencies (Prisma client is auto-generated via `postinstall`)
> 3. Creates the local SQLite database and runs all migrations
> 4. Seeds it with machines, playbooks, and sample sessions
> 5. Starts both the Next.js frontend and the Socket.IO server in parallel

---

### 2. Environment Variables (Optional)

The app runs out of the box with default settings. To enable the Matterport 3D viewer and AI features, create a `.env.local` file:

```bash
cp .env .env.local
```

Then fill in:

```env
NEXT_PUBLIC_MATTERPORT_SDK_KEY=your_matterport_sdk_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_MATTERPORT_SDK_KEY` | For 3D viewer | Obtain at [matterport.com/developers](https://matterport.com/developers) |
| `ANTHROPIC_API_KEY` | For AI features | AI summaries are shown as "Coming Soon" without it |

---

## Running the Demo on Two Browsers

FieldSync is a **two-person platform** — you need two browser windows open simultaneously to demonstrate the full expert ↔ worker interaction.

### Setup

| Window | URL | Role |
|---|---|---|
| **Window 1** | `http://localhost:3000` | Worker — the person on the factory floor |
| **Window 2** | `http://localhost:3000` (Incognito) | Expert — the remote specialist |

> Use a **normal window** for one role and a **private / incognito window** for the other. This ensures each has its own separate identity stored in `localStorage`.

---

### Step-by-Step Demo Flow

**Step 1 — Expert goes online (Window 2)**
1. Click **"I'm an Expert"**
2. Enter a name and select machine certifications (e.g. *Krones Filler*)
3. Land on the Expert Dashboard
4. Toggle the **Available** switch to go online

**Step 2 — Worker opens an SOS call (Window 1)**
1. Click **"I'm a Worker"**
2. Enter a name and factory name
3. Land on the Worker Dashboard → click **Open SOS Call**
4. Select the same machine the expert certified for
5. Optionally add your location (Department / Line / Station)
6. Click **"Connect to Live Expert"**

**Step 3 — Live session begins**

Both windows automatically navigate into the live 3D session.

Try these features:
- 🏷️ **Expert** switches to Marker mode (top-right mode bar) and clicks a surface to place a marker
- 🎙️ **Expert** holds the floating microphone button to send a voice message
- 📋 **Expert** opens a Playbook and sends a repair step to the worker
- 🖐️ **Worker** clicks "Request Control" to drive the 3D camera — the Mirror button on the expert's side flashes amber
- ✅ **Expert** opens the Mirror FAB (top-left of viewer) and grants camera control
- 🔚 **Expert** ends the session and marks it as resolved

**Step 4 — Review the session record**

In Window 1 (Worker): go back to Dashboard → **View Call History** → expand the latest entry to see all markers, instructions, and voice messages recorded.

---

## Project Structure

```
remote-expert-app/
├── app/                        # Next.js App Router pages & API routes
│   ├── page.tsx                # Landing page — role selector
│   ├── onboarding/             # Per-role onboarding forms
│   ├── dashboard/              # Worker / Expert / Administrator dashboards
│   ├── worker/                 # Live worker session view (3D + controls)
│   ├── expert/                 # Live expert console (panel + 3D viewer)
│   └── api/                    # REST API endpoints
├── components/
│   ├── expert/                 # Expert UI (floating mode bar, mirror FAB, playbooks)
│   ├── worker/                 # Worker UI (SOS flow, PTT FAB, control request)
│   └── shared/                 # Shared components (PTT button, feedback modal)
├── server/
│   └── index.ts                # Socket.IO server — real-time session orchestration
├── lib/
│   ├── machines.ts             # Machine catalogue & lookup map
│   ├── identity.ts             # localStorage role / session helpers
│   └── ai.ts                   # AI summary generation (Anthropic SDK)
├── prisma/
│   ├── schema.prisma           # Database schema (SQLite)
│   └── seed.ts                 # Seed data — machines, playbooks, demo sessions
└── types/
    └── socket.ts               # Fully typed Socket.IO event definitions
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 |
| Real-time | Socket.IO 4 |
| 3D Viewer | Matterport Bundle SDK |
| Database | SQLite · Prisma 7 · better-sqlite3 |
| Language | TypeScript 5 (strict) |
| Icons | Lucide React |

---

## Future Features

### 🤖 AI-Powered Troubleshooting Guide
Every completed session will automatically generate a structured repair summary using **Claude (Anthropic AI)**. The guide will include:
- A clear description of the problem identified during the call
- Numbered step-by-step repair instructions extracted from the expert's guidance
- Safety warnings raised during the session
- Marker positions and physical locations referenced in the 3D model

Workers will see this guide in their call history. It will also surface as a smart suggestion the next time a worker calls about the same machine — so common problems can be solved without ever needing to call an expert.

### 📊 Factory Manager Analytics Dashboard
A dedicated **Manager** role with a full operational analytics view:
- **Resolution rate** — percentage of calls that ended as resolved, over time
- **MTTR** — mean time to repair per machine, per line
- **Safety trend** — frequency of emergency stops over selected periods
- **AI deflection rate** — how often workers solve issues from past sessions without calling a live expert
- **Hotspot map** — which machines generate the most support calls
- **Period comparison** — KPIs vs. the previous equivalent window

### ✏️ Live Drawing on 3D
Beyond point markers, experts will be able to draw directly on the 3D model surface — circles, arrows, and freehand paths — to direct worker attention with more precision than a single pin.

### 📅 Scheduled Expert Sessions (Classrooms)
Experts will be able to create scheduled group sessions — remote training classes where multiple workers join a shared 3D space at a set time for structured guided learning.

### 📱 Mobile Worker App
A lightweight app (React Native) optimised for the factory floor — oversized PTT button, simplified one-tap SOS, and augmented reality marker overlay via the device camera so instructions appear anchored to the real machine.

### 🌍 Multi-language Support
PTT transcription and AI summaries in the worker's local language, with automatic translation for experts who speak a different language. Designed for global manufacturing sites.

---

## License

Private — all rights reserved. Built for Treedis.
