# cappy.ai

A study assistant that runs entirely on Firebase's free plan. Upload your PDF notes, then summarise them, quiz yourself, search them, generate exam papers and solve them.

---

## Features

| Feature | What it does |
| :--- | :--- |
| Documents | Upload PDFs. Text is read in your browser, scanned pages are read with OCR, and the original file is kept so you can download it again |
| Summaries | Short, detailed or bullet summaries, optionally about one topic |
| Quiz and flashcards | Multiple-choice quizzes and flip cards |
| Exam papers | Generate a 70-mark paper, or upload one and get model answers |
| Deep search | Keyword search across all your notes with a relevance score |

---

## How it is built

| Part | Technology |
| :--- | :--- |
| Website | React 18, Vite, React Router, Tailwind, Lucide icons |
| Login | Firebase Authentication (email and password) |
| Database | Cloud Firestore |
| AI | Gemini through Firebase AI Logic |
| PDF reading | pdf.js, plus Tesseract OCR in the browser |
| Hosting | Firebase Hosting |

There is no server. The browser talks to Firebase directly, and Firestore security rules make sure each person can only see their own data.

---

## Project layout

```text
cappy.ai/
├── firebase.json          Hosting and Firestore settings
├── firestore.rules        Who can read and write what
├── .firebaserc            Which Firebase project to use
└── frontend/
    ├── .env.local         Your Firebase keys (not in git)
    └── src/
        ├── firebase.js    Connects to Firebase
        ├── services/      Everything that talks to Firebase and Gemini
        ├── context/       Login state and theme
        ├── components/    Navbar, Sidebar, upload, logo, ...
        └── pages/         Dashboard, Chat, Summary, Quiz, ...
```

---

## Run it on your computer

You need Node.js 18 or newer.

1. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the values from Firebase console, Project settings, Your apps.
2. Start the site:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open http://localhost:6969

---

## Deploy

```bash
cd frontend && npm run build && cd ..
firebase deploy
```

This publishes the website and the Firestore rules. Your site is then live at `https://cappy-ai-4a68b.web.app`.

To use your own domain, add it in Firebase console, Hosting, Add custom domain, then create the DNS records it shows you.

---

## One-time Firebase setup

| Step | Where in Firebase console |
| :--- | :--- |
| Turn on login | Build, Authentication, Sign-in method, Email/Password |
| Turn on AI | Build, AI Logic, choose Gemini Developer API |
| Create database | Build, Firestore Database, production mode |
| Protect the AI | Build, App Check, see below |

### App Check

App Check makes sure only your website can use your free Gemini quota.

1. Create a reCAPTCHA v3 key at https://www.google.com/recaptcha/admin. Add `localhost`, `cappy.ai` and `cappy-ai-4a68b.web.app` as domains.
2. In Firebase console, App Check, Apps, open your web app and register with reCAPTCHA v3 using the secret key.
3. Put the site key in `frontend/.env.local` as `VITE_RECAPTCHA_SITE_KEY` and redeploy.
4. In App Check, APIs, turn on enforcement for Firebase AI Logic.

For local development, the first run prints a debug token in the browser console. Add it under App Check, Apps, Manage debug tokens.

---

## Free plan limits

| Limit | Value | Effect |
| :--- | :--- | :--- |
| Firestore reads | 50,000 per day | Notes are stored in blocks, so one search costs a few reads |
| Firestore writes | 20,000 per day | An upload uses one write per MB of PDF, plus a few more |
| Firestore storage | 1 GiB, shared by everyone | Notes text plus the original PDFs; a 1 MB PDF uses about 1.1 MB |
| Gemini requests | Shared by all users | If it runs out, the app asks people to retry in a minute |
| Exam-paper solves | 7 per person per day | Enforced by the Firestore rules |
