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
