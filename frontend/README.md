NEXUS web frontend (Next.js 16 App Router) for the FastAPI backend in `../backend`.

## Getting Started

1) Set the backend URL:

```bash
cp .env.example .env.local
```

2) Run the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Backend endpoints used:
- `GET /api/metrics`
- `GET /api/tracks`
- `POST /api/match-audio`
- `GET /api/telecom/sectors`
- `GET /api/events` (SSE)

Notes:
- Dark mode is default; theme toggle is persisted in `localStorage` (`nexus:theme`).
- Charts are powered by `recharts` and update live from the SSE stream when available.
