# FXSignal — web app

React + Vite + TypeScript frontend for FXSignal: intraday EUR/USD and USD/JPY signals, the weekly outlook, live signal progress, a position size calculator, a personal trade journal and a public track record.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. In development the app calls the local API at `http://localhost:4004/api`; production builds call `https://fxsignal.duckdns.org/api`. Set `VITE_API_URL` to override either.

## Build

```bash
npm run build   # type-checks, then outputs static files to dist/
```

## Routes

- `/` landing · `/track-record` public track record · `/login` · `/register`
- `/app` overview · `/app/signals` · `/app/outlook` · `/app/calendar` · `/app/performance` · `/app/journal` · `/app/billing` · `/app/settings` · `/app/methodology`

FXSignal is market analysis for research and education, not financial advice.

## Deploying on Vercel

Production: **https://fxsignal-frontend.vercel.app**, built from `main` of this repo. The API runs separately at **https://fxsignal.duckdns.org** (see the [backend deployment guide](https://github.com/AtumaDavid/fxsignal-backend#aws-ec2-deployment-guide)).

Traffic: browser → Vercel (static files) → API calls over HTTPS to `https://fxsignal.duckdns.org/api` → Nginx → API → Neon Postgres.

### Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None needed |

Every push to `main` triggers a production deploy.

### API address

The API address is in [`src/lib/api.ts`](src/lib/api.ts):

- production builds call `https://fxsignal.duckdns.org/api`;
- `npm run dev` calls `http://localhost:4004/api`;
- `VITE_API_URL` overrides both. **It must end in `/api`**: `https://fxsignal.duckdns.org` alone sends requests to `/dashboard` instead of `/api/dashboard`, and adding `/api` in both places sends them to `/api/api/...`.

Vite bakes the value in at build time, so changing it in Vercel does nothing until you **redeploy**. If you don't need an override, leave `VITE_API_URL` unset in Vercel.

### Client-side routes

This is a single-page app: Vercel only has `index.html`, and the app's router handles `/app/signals`, `/track-record` and so on. [`vercel.json`](vercel.json) rewrites every path that isn't a real file to `index.html`. Without it, refreshing or opening a deep link returns Vercel's `404 NOT_FOUND`.

### CORS

The API only accepts browser requests from allowed origins. `https://fxsignal-frontend.vercel.app` and localhost are allowed in the backend's code. **Vercel preview URLs** (`fxsignal-frontend-git-…vercel.app`) and any custom domain are different origins: add them to `FRONTEND_URL` in the server's `.env` (comma-separated, no trailing slash), then run `pm2 restart fxsignal --update-env` on the server.

### Verify a deploy

1. Open the site, then **DevTools → Network**. API calls should go to `fxsignal.duckdns.org/api/...` and return 200.
2. Refresh on a deep link such as `/app/signals`: it should load the app, not a 404.
3. From a terminal, the API should allow the site's origin:

```bash
curl -i -X OPTIONS https://fxsignal.duckdns.org/api/auth/login \
  -H "Origin: https://fxsignal-frontend.vercel.app" \
  -H "Access-Control-Request-Method: POST"
# expect: Access-Control-Allow-Origin: https://fxsignal-frontend.vercel.app
```

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404 NOT_FOUND` from Vercel when refreshing a page | Missing SPA rewrite | Keep `vercel.json` in the repo and redeploy |
| CORS error in the console | The site's origin isn't allowed by the API | Add it to `FRONTEND_URL` on the server and restart PM2 |
| Calls go to `localhost:4004` | A dev build was deployed, or `VITE_API_URL` points there | Unset or fix `VITE_API_URL` in Vercel, redeploy |
| Calls go to `/api/api/...` or miss `/api` | `VITE_API_URL` has the wrong suffix | It must end in exactly `/api` |
| Changed `VITE_API_URL` but nothing changed | Vite reads it at build time | Redeploy |
| "Cannot reach the FXSignal API" banner | API down or HTTPS certificate problem | `curl -i https://fxsignal.duckdns.org/health`; check `pm2 status` on the server |
