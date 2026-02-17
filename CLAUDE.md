# ProveIt Student Frontend - Claude Code Context

## Project Overview
Student-facing interface for ProveIt. Students submit papers and take AI-generated comprehension quizzes in lockdown mode to verify authorship.

## Tech Stack
- React 19 + TypeScript
- Vite 6 (build tool)
- Tailwind CSS 4
- @rcnr/theme (CSS tokens)
- Axios (API client)
- lucide-react (icons)
- react-router-dom (routing)

## Architecture
- **Auth:** Token-based (no Clerk) — students authenticate via access code
- **Lockdown:** Fullscreen lockdown during quiz taking
- **API:** Axios client in src/api/ hitting FastAPI backend (rcnr-ai-api)
- **Source:** src/api, src/components, src/hooks, src/lib, src/pages, src/types

## Design System
- Uses @rcnr/theme: `@import "tailwindcss"; @import "@rcnr/theme";`
- Same RCNR dark brand: bg-midnight, glass-card, text-brand hierarchy

## Commands
- `npm run dev` — Start dev server (port 5174)
- `npm run build` — Production build

## Deployment
- Vercel (vercel.json)
- Backend: FastAPI at rcnr-ai-api (Railway)
