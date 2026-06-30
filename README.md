<div align="center">
<img width="1200" height="475" alt="Built with Google AI Studio" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />

# DeadlineGPT

### AI-Powered Productivity Companion That Never Lets You Miss a Deadline

[![Built with Gemini](https://img.shields.io/badge/Built%20with-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

*Turn plain-language task descriptions into smart, auto-scheduled plans. Gemini handles prioritization, scheduling, and reminders — so you never miss a deadline.*

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Chat Interface** | Describe tasks in natural language — Gemini extracts titles, deadlines, priorities & subtasks automatically |
| **Smart Auto-Scheduling** | AI distributes work across days with conflict-free time slots based on your available hours |
| **Analytics Dashboard** | Track completion rates, productivity streaks, and task distribution with visual charts |
| **Smart Nudges** | Context-aware AI reminders that warn you about approaching deadlines and suggest action |
| **Task Breakdown** | One-click AI decomposition of complex tasks into 3-5 actionable subtasks |
| **Google Calendar Sync** | Two-way sync with Google Calendar — tasks auto-appear as calendar events |
| **Voice Input** | Speak your tasks — Gemini transcribes and processes voice recordings |
| **Image/File OCR** | Upload images or documents — Gemini extracts text and creates tasks from them |
| **Focus Mode** | Distraction-free Pomodoro-style focus sessions with timer |
| **Smart Reschedule** | AI detects overdue tasks and suggests optimal new time slots |
| **Dark/Light Mode** | Full theme support with smooth transitions |
| **Keyboard Shortcuts** | `Ctrl+1-4` for instant navigation between pages |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| **Backend** | Express.js + Vite dev server (unified) |
| **AI Engine** | Google Gemini 3.1 Flash Lite (with Pro fallback) |
| **Auth & DB** | Firebase Authentication + Cloud Firestore |
| **Calendar** | Google Calendar API (OAuth 2.0) |
| **Other** | EmailJS (contact form), jsPDF (exports), Three.js (3D effects) |

---

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) (v18+)

```bash
# 1. Clone the repository
git clone https://github.com/adityabokde2007/DeadlineGPT.git
cd DeadlineGPT

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env

# 4. Add your Gemini API key to .env
# Get one free at: https://aistudio.google.com/apikey
# GEMINI_API_KEY="your_key_here"

# 5. Start the dev server
npm run dev
```

The app will be running at **http://localhost:3000** 🎉

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key ([Get one here](https://aistudio.google.com/apikey)) |
| `GOOGLE_CLIENT_ID` | Optional | For Google Calendar OAuth integration |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google Calendar OAuth integration |

> **Note:** Firebase client config is pre-configured. No Firebase setup needed to run locally.

---

## Project Structure

```
DeadlineGPT/
├── server.ts                 # Express backend + Gemini API routes
├── src/
│   ├── pages/
│   │   ├── Landing.tsx       # Landing page with hero, features, reviews
│   │   ├── Dashboard.tsx     # Main task management dashboard
│   │   ├── ChatInterface.tsx # AI chat for task creation
│   │   ├── CalendarView.tsx  # Calendar with scheduled tasks
│   │   └── Analytics.tsx     # Productivity analytics & charts
│   ├── components/           # Reusable UI components
│   ├── context/              # Auth context provider
│   ├── firebase/             # Firebase config & auth helpers
│   ├── services/             # Firestore & Google Calendar services
│   └── hooks/                # Custom React hooks
├── firestore.rules           # Firestore security rules
├── security_spec.md          # Adversarial security test spec
└── .env.example              # Environment variable template
```

---

## Security

- All Firestore data is protected by comprehensive [security rules](firestore.rules) with owner-exclusivity enforcement
- Server-side API key management — Gemini keys never reach the client
- Input validation and schema enforcement on all database operations
- Adversarial security testing with 12 documented attack payloads ([security_spec.md](security_spec.md))

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | TypeScript type checking |

---

<div align="center">

**Built with ❤️ using [Google AI Studio](https://ai.studio) and [Gemini API](https://ai.google.dev/)**

</div>
