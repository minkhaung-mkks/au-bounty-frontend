# AU Bounty Frontend

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?logo=reactrouter&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io_Client-4-010101?logo=socket.io&logoColor=white)
![Oxlint](https://img.shields.io/badge/lint-Oxlint-1E1E2E?logo=oxlint&logoColor=white)

The web client for [AU Bounty](https://github.com/sasta-kro/au-bounty), a campus task and event platform for Assumption University: a bounty board with real time chat, rotating-code event check-in, verified public profiles, and double-blind reviews.

This repository is a git submodule of the umbrella repo, which composes the full stack and holds the documentation:

- Umbrella: https://github.com/sasta-kro/au-bounty
- Backend: https://github.com/minkhaung-mkks/au-bounty-backend
- Live deployment: https://sai-aike-shwe-tun-aung-backend2.indonesiacentral.cloudapp.azure.com/aubounty/

## Screens

- **Board**: task feed with search, skill matched ranking, and per-type tabs, plus live emergency alerts pushed over the socket connection
- **Task and event detail**: apply, approve, complete, and confirm flows. Attachment upload with progress and retry. Location with map and directions when keyed, manual coordinates otherwise
- **Check-in**: organizer view with the rotating 6 digit code, countdown, and QR. Attendee code entry with instant verification
- **Messages**: one thread per assignment, live delivery, read receipts, unread badges
- **Profile**: public share links that work signed out, with the full review history
- **Admin console**: roles, organizations, tags, review moderation, each action confirmed
- **Create**: requests, emergencies, and events with rewards, tags, spots, and acceptance mode

## Stack

React 19, Vite 8, react-router 7, socket.io-client. Plain JSX with hand written CSS design tokens. No UI framework, no state library. Oxlint for linting.

## Run it

Against the full stack (simplest):

```bash
# in the umbrella repo
docker compose up --build
# the SPA is served at http://localhost:8080/aubounty/
```

Standalone with a backend already running on port 4000:

```bash
npm install
npm run dev      # http://localhost:5173/aubounty/
npm run build    # production bundle, served by the nginx image
```

The dev server proxies `/aubounty/api` and `/aubounty/socket.io` to `localhost:4000`, so it calls the same URLs the containerized nginx serves. The app mounts under the `/aubounty/` base everywhere.

One optional variable, `VITE_GOOGLE_MAPS_KEY` in `.env.production`: the Google Maps browser key for the interactive map picker and Places autocomplete. Public by design, restricted by HTTP referrer in the Google console. Without it the create form uses typed place names and manual coordinates.

## Layout

```
src/
├── screens/      board, task and event detail, create, check-in, messages, profile, admin, emergency, login
├── components/   task cards, attachments, banners, shared ui
├── layout/       app shell: navigation, badges, weather, emergency banners
├── lib/          socket connection manager, upload helpers, formatting
├── session.jsx   auth state, capability flags from /meta
└── api.js        fetch client for the same-origin API
```

## Documentation

All project documentation lives in the umbrella repo: [architecture](https://github.com/sasta-kro/au-bounty/blob/main/docs/architecture.md), [API reference](https://github.com/sasta-kro/au-bounty/blob/main/docs/api.md), [configuration](https://github.com/sasta-kro/au-bounty/blob/main/docs/configuration.md), [getting started](https://github.com/sasta-kro/au-bounty/blob/main/docs/getting-started.md).

## Team

Term project for **CSX4110 Backend Application Development (Section 542)** at Assumption University.

| Developer | Student ID | Email |
|---|---|---|
| Sai Aike Shwe Tun Aung | 6712122 | u6712122@au.edu |
| Min Khaung Kyaw Swar | 6712164 | u6712164@au.edu |
| Ekaterina Kazakova | 6720065 | u6720065@au.edu |
