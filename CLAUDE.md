# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server (Turbopack, with experimental filesystem cache enabled).
- `npm run build` — production build.
- `npm start` — run the production build.
- `npm run lint` — run ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` and `next/typescript`).

No test runner is configured.

## Architecture

- Next.js 16 App Router project (`app/` directory). Entry points are `app/layout.tsx` (root layout) and `app/page.tsx`. Global styles live in `app/globals.css` (Tailwind v4 via `@tailwindcss/postcss`, plus `tw-animate-css`).
- React 19 with the **React Compiler enabled** (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` installed). Avoid hand-written `useMemo`/`useCallback` micro-optimizations the compiler will handle; do not write code that relies on referential stability the compiler may change.
- TypeScript strict mode is on. Path alias `@/*` maps to the repo root (e.g. `@/app/...`).
- `devIndicators: false` — the Next.js dev overlay indicator is disabled.

## Notes

- This is a near-stock `create-next-app` scaffold; there is no custom backend, API routes, state library, or component library wired up yet. When adding structure (e.g. `components/`, `lib/`), follow App Router conventions and use the `@/` alias.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
