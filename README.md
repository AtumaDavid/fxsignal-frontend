# FXSignal — web app

React + Vite + TypeScript frontend for FXSignal: intraday EUR/USD and USD/JPY signals, the weekly outlook, live signal progress, a position size calculator, a personal trade journal and a public track record.

## Run locally

```bash
npm install
cp .env.example .env   # point VITE_API_URL at the FXSignal API
npm run dev
```

Open http://localhost:5173. The app expects the FXSignal API running at `VITE_API_URL` (default `http://localhost:4004/api`).

## Build

```bash
npm run build   # type-checks, then outputs static files to dist/
```

## Routes

- `/` landing · `/track-record` public track record · `/login` · `/register`
- `/app` overview · `/app/signals` · `/app/outlook` · `/app/calendar` · `/app/performance` · `/app/journal` · `/app/billing` · `/app/settings` · `/app/methodology`

FXSignal is market analysis for research and education, not financial advice.
