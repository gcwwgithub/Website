# ChineseQuizNew

React/Vite vocabulary quiz app for deployment under `/Website/ChineseQuizNew/`.

Source lives in `.ChineseQuizNewApp`. The static output is generated into `../ChineseQuizNew`.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in your Supabase project URL and anon key.
3. Sign in once in Supabase Auth, copy your user UUID from Authentication > Users, then replace the placeholder UUID in `../supabase.sql`.
4. In Supabase, run `../supabase.sql` in the SQL editor.
5. Run:

```bash
npm install
npm run dev
```

Quiz settings and CSV color progress are still stored in the browser with local storage. Supabase silently mirrors the signed-in user's CSV color progress in the background, so the quiz remains usable even when you are signed out.

## Supabase Notes

Use the public anon key in `.env.local`; it is designed to be used in browser apps. Access control is handled by Supabase Auth and row level security policies in `supabase.sql`, where the owner UUID stays in the database policy instead of the frontend bundle.

Enable Supabase email/password auth and set a password for your owner user. The app uses password login, not email magic links.

The visible app does not include database word or progress management pages. Database rows are for private color-progress tracking only.

## Build

```bash
npm run build
```

The generated files are written directly into `../ChineseQuizNew`, which is the folder linked from the main website.

## GitHub Pages / Copilot Deployment

Supabase values are Vite build-time environment variables. `.env.local` is ignored by git, so a GitHub-built deployment must provide these values during the build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

If GitHub builds the app, add them as repository variables or secrets and expose them to the build step. Example GitHub Actions build step:

```yaml
- name: Build ChineseQuizNew
  working-directory: .ChineseQuizNewApp
  env:
    VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: |
    npm ci
    npm run build
```

If you build locally and commit the generated `ChineseQuizNew` folder, make sure `.env.local` has the real Supabase values before running `npm run build`. The public anon key is safe to ship in the browser; row access is protected by Supabase RLS in `../supabase.sql`.
