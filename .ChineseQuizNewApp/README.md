# ChineseQuizNew

React/Vite Firebase vocabulary quiz app for deployment under `/Website/ChineseQuizNew/`.

Source lives in `.ChineseQuizNewApp`. The GitHub Pages output is generated into `../ChineseQuizNew`.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in your Firebase web app config values.
3. Enable Firebase Authentication and Cloud Firestore in your Firebase project.
4. Run:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The generated files are written directly into `../ChineseQuizNew`, which is the folder linked from the main website.
