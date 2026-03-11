# 001 Shell & Routing

## Scope

- Introduce a route-based app shell.
- Replace the old sidebar behavior with terminal navigation and global ticker lookup.
- Create placeholder routes for `Screener`, `Ticker`, `Compare`, and `Saved`.
- Add the SDD workspace and feature chain docs.

## Acceptance Criteria

- The app renders through a router shell instead of the former single-page `App`.
- Navigation between the new routes works without full-page reloads.
- The ticker form routes to `/ticker/:symbol`.
- The codebase contains a resumable spec/task/notes structure for all eight features.
