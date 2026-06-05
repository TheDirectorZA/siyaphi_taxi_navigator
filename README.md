# Siyaphi Taxi Navigator

A production-grade, locally runnable taxi navigation app for South Africa's informal minibus taxi network.

## What This Is

Siyaphi ("Where are you going?" in Zulu) helps commuters:
- Find taxi routes between origins and destinations
- Locate nearby taxi ranks and stops
- View fare ranges and ETA estimates
- Submit and receive live crowd-sourced updates on delays, availability, and safety
- Use the app fully offline with cached data

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (React Native / Expo)            │
│  Search → Map View → Route Detail → Report → Offline Cache      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS REST + WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                     API GATEWAY (NestJS)                        │
│  Rate Limiting · Auth · Versioning · Request Routing            │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │          │
┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌───▼──┐  ┌────▼─────┐
│Route│  │Stop/ │  │ Fare  │  │ ETA  │  │  Live    │
│Srvc │  │Rank  │  │ Srvc  │  │ Srvc │  │ Update   │
│     │  │ Srvc │  │       │  │      │  │  Srvc    │
└──┬──┘  └───┬──┘  └────┬──┘  └───┬──┘  └────┬─────┘
   └─────────┴──────────┴─────────┴───────────┘
                         │
        ┌────────────────▼────────────────┐
        │    PostgreSQL + PostGIS          │
        │    Redis (optional, local)       │
        │    Local File Storage            │
        └─────────────────────────────────┘
```

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Mobile | React Native + Expo | Cross-platform, large SA Android ecosystem |
| Backend | Node.js + NestJS | TypeScript, modular, well-documented |
| Database | PostgreSQL + PostGIS | Geospatial queries, free, production-grade |
| Cache | Redis (optional) | Self-hosted, fast, free |
| Maps | OpenStreetMap + react-native-maps | No API cost |
| Tiles | OSM tile CDN (free tier) | No self-hosting needed for MVP |
| Realtime | WebSocket (socket.io) | Built into NestJS, no external broker |
| Queue | Bull + Redis or DB-backed jobs | Self-hosted, no paid broker |
| Auth | JWT + anonymous device tokens | No external auth service |
| Monitoring | Prometheus + Grafana (local) | Free, self-hosted |
| Logging | Pino + file output | Zero cost |

## Project Structure

```
siyaphi_taxi_navigator/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── routes/           # Route search service
│   │   ├── stops/            # Stop/rank service
│   │   ├── fares/            # Fare estimation service
│   │   ├── eta/              # ETA service
│   │   ├── reports/          # Live update / crowd report service
│   │   ├── notifications/    # Push notification service
│   │   ├── auth/             # Auth + device identity
│   │   ├── admin/            # Admin and moderation endpoints
│   │   ├── sync/             # Offline sync endpoints
│   │   └── common/           # Shared utilities
│   ├── prisma/               # Database schema and migrations
│   └── test/                 # Backend tests
├── mobile/                   # React Native Expo app
│   ├── src/
│   │   ├── screens/          # All app screens
│   │   ├── components/       # Reusable UI components
│   │   ├── navigation/       # React Navigation setup
│   │   ├── store/            # Zustand state management
│   │   ├── services/         # API, offline, sync services
│   │   ├── hooks/            # Custom hooks
│   │   ├── i18n/             # Multilingual support
│   │   └── utils/            # Helpers
│   └── assets/               # Icons, fonts, offline map data
├── infra/
│   ├── docker-compose.yml    # Full local stack
│   ├── docker-compose.dev.yml
│   └── seed/                 # SQL seed data for local dev
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── FAILURE_MATRIX.md
│   └── SECURITY.md
└── scripts/
    ├── setup.sh              # One-command local setup
    └── seed.sh               # Database seeding
```

## Quick Start

```bash
# 1. Clone and enter project
cd siyaphi_taxi_navigator

# 2. Run setup (installs deps, starts DB, runs migrations, seeds data)
./scripts/setup.sh

# 3. Start backend
cd backend && npm run start:dev

# 4. Start mobile app
cd mobile && npx expo start

# 5. (Optional) Start monitoring
docker-compose -f infra/docker-compose.yml up prometheus grafana
```

## Local Development Ports

| Service | Port |
|---------|------|
| Backend API | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Prometheus | 9090 |
| Grafana | 3001 |
| PgAdmin | 5050 |

## Design Principles

1. **Offline-first**: The app works without internet. Data is cached locally.
2. **Confidence-based data**: All fares, ETAs, and routes show confidence and freshness signals.
3. **Graceful degradation**: Every screen has a fallback state.
4. **Privacy-first**: Minimal data collection. Anonymous use by default.
5. **City-by-city rollout**: Data is segmented by city. Start with one city.
6. **Crowd-sourced with moderation**: Reports are scored and validated before display.

## Open Questions (Pre-Build Clarifications Needed)

1. Which city to launch first? (Joburg, Cape Town, Durban?)
2. How is initial route data sourced? (Manual capture, community input, digitization?)
3. Who maintains the admin dashboard? (In-house team, community moderators?)
4. What languages must be supported at launch? (English + Zulu minimum?)
5. Is there a budget for SMS fallback notifications later?
6. Who owns trust/safety decisions for moderating reports?
