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

## Design System — MANDATORY
- Uses @rcnr/theme v4: `@import "tailwindcss"; @import "@rcnr/theme";`
- **NEVER hardcode hex colors.** All colors MUST come from theme tokens.
- Text: `text-fg` (primary), `text-fg-muted` (secondary), `text-fg-dim` (tertiary). NEVER `text-white`.
- Backgrounds: `var(--rcnr-surface)`, `var(--rcnr-surface2)`, `glass-card` class. NEVER `bg-[#0A1E2E]`.
- Inputs: use `rcnr-input` class. NEVER `bg-surface-light ... text-white ... placeholder-brand/30`.
- Cards: `rcnr-card` (interactive) or `rcnr-card-flat` (static). NEVER inline bg/border/shadow.
- Buttons: `btn-amber` (CTA), `btn-ice` (secondary), `btn-ghost` (tertiary). NEVER inline button styles.
- Borders: `var(--rcnr-border)` or `border-brand/15`. NEVER `rgba(153,217,217,0.1)`.
- Exception: `text-white` IS okay on colored-bg buttons (`bg-blue-600 text-white`).
- See @rcnr/theme CLAUDE.md for the full token reference table.

## Commands
- `npm run dev` — Start dev server (port 5174)
- `npm run build` — Production build

## Deployment
- Vercel (vercel.json)
- Backend: FastAPI at rcnr-ai-api (Railway)
