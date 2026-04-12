# 🌿 LocalLoop

> **Your neighborhood. Your voice. Fixed.**

LocalLoop is an AI-powered civic reporting platform that empowers 
residents to report neighborhood issues, rally their community, and 
get city departments to take action — fast.

Built in 48 hours for the **Build with AI: Code Social Hackathon** 
using Google's AI stack.

🔗 **Live Demo:** https://localloop-agent.netlify.app

---

## ✨ Features

- 📸 **AI-Powered Issue Reporting** — Upload a photo and Gemini 
  automatically categorizes the issue, estimates severity, and 
  generates a professional complaint letter to the relevant city 
  department
- 🗺️ **Live Community Map** — Real-time Leaflet map showing all 
  reported issues as color-coded markers (Red=Critical, 
  Orange=Medium, Green=Low)
- 🔥 **Hot Zone Detection** — Clusters of 3+ nearby issues 
  automatically escalate into "Hot Zones" visible on the map
- 👍 **Community Upvoting** — Residents can upvote issues; reports 
  hitting 10 upvotes get auto-escalated to city departments
- 📊 **Live Dashboard** — Real-time stats on open issues, resolved 
  this week, and most affected neighborhoods powered by Firestore
- 🔍 **Neighborhood Search** — Filter issues by neighborhood, 
  zip code, category, severity, or status
- 🚨 **Emergency Resources** — Instant access to Chicago emergency 
  contacts (911, 311, CDOT, ComEd) when urgent help is needed
- 👤 **Google Auth** — Sign in with Google to track your personal 
  reports via "My Reports" dashboard
- 📱 **Mobile Responsive** — Works seamlessly on phones for 
  on-the-go reporting

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| AI | Google Gemini 1.5 Flash API |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (Google OAuth) |
| Maps | Leaflet.js + OpenStreetMap |
| Geocoding | Browser Geolocation API + OpenStreetMap Nominatim |
| Hosting | Netlify |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project
- A Google Gemini API key (free at aistudio.google.com)

### Installation

1. **Clone the repo**
```bash
git clone https://github.com/AdibaAdi/LocalLoop.git
cd LocalLoop
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```
Fill in your credentials in `.env`:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_key
```

4. **Start the dev server**
```bash
npm run dev
```

---

## 🔥 Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Google sign-in
3. Create a **Firestore** database in test mode
4. Add your domain to **Authorized Domains** in Auth settings

---

## 🤖 How Gemini AI Works

When a user uploads a photo, LocalLoop sends it to **Gemini 1.5 Flash** with a structured prompt requesting:

- **Category** — Pothole, Flooding, Broken Light, Graffiti, Safety Hazard
- **Severity** — Low, Medium, Critical  
- **Summary** — One-sentence description
- **Complaint Letter** — A formal 3-paragraph letter addressed to the relevant Chicago city department

The response streams in with a typewriter effect, making the AI feel alive and responsive.

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.jsx          # Navigation + Google Auth
│   ├── IssueMap.jsx        # Leaflet map with markers
│   ├── ReportIssueModal.jsx # AI-powered report form
│   ├── EmergencyModal.jsx  # Emergency contacts
│   └── Footer.jsx
├── pages/
│   ├── LandingPage.jsx     # Hero + stats + how it works
│   ├── DashboardPage.jsx   # Map + filters + leaderboard
│   └── MyReportsPage.jsx   # User's personal reports
├── hooks/
│   └── useFadeInOnView.js  # Scroll animation hook
└── lib/
    └── firebase.js         # Firebase initialization
```

---

## 🌍 Deployment

Deployed on **Netlify** with automatic deploys from GitHub main branch.

```bash
npm run build   # builds to /dist
```

Add all `VITE_*` environment variables in Netlify's project settings before deploying.

---

## 👩‍💻 Built By

**Adiba Akter** — CS Student at IIT Chicago  
Built solo in 48 hours for the Google Build with AI Hackathon  

[![GitHub](https://img.shields.io/badge/GitHub-AdibaAdi-black?logo=github)](https://github.com/AdibaAdi)

---

## 📄 License

MIT License — feel free to fork and build your own city's version!
```

This README will look great to judges and recruiters on GitHub! 🚀
