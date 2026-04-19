# OrderPing

## Overview

OrderPing is a food court order notification SaaS for Indian malls. Vendors call orders via a numpad dashboard, and customers track their food in real-time via QR code — no app download required.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (dark theme, green/orange accents)
- **Backend**: Express 5 + Socket.io for real-time WebSockets
- **Storage**: In-memory store (no DB — MVP/demo)
- **QR Generation**: qrcode npm package
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Pages

- `/` — Landing page (marketing, how it works, demo)
- `/register` — Vendor registration → QR code generation
- `/vendor/:slug` — Vendor dashboard (password protected, numpad, READY button)
- `/track/:slug` — Customer tracking page (QR opens this, bilingual EN/HI)
- `/admin` — Admin analytics (password: `admin123`)

## Demo Stalls (pre-seeded)

| Stall | Slug | Password |
|-------|------|----------|
| Haldirams | haldirams | demo123 |
| McDonalds | mcdonalds | demo123 |
| Dominos Pizza | dominos | demo123 |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

- Frontend at `/` (React + Vite, port 21623)
- API server at `/api` (Express, port 8080)
- Socket.io path: `/api/socket`
- QR code PNG served at `/api/stalls/:slug/qr-code`

## Real-time Features

- Socket.io rooms: `stall:<slug>` for vendors, `order:<slug>:<receiptNumber>` for customers
- Events: `order:ready`, `order:nudge`, `order:updated`, `stall:order:updated`
- Polling fallback: every 5 seconds if WebSocket unavailable
- Wake Lock API: keeps customer screen on while tracking
- Vibration API + Web Audio API chime when order is ready
