# Investment Terminal SDD

This workspace stores the resumable implementation spec for the stacked terminal rewrite.

## Goals

- Replace the single-page analysis app with a route-based local investment terminal.
- Keep work reviewable as a stacked branch chain with one draft PR per feature.
- Make the implementation resumable without chat history by keeping scope, tasks, and notes in-repo.

## Feature Chain

1. `001-shell-routing`
2. `002-data-provider-snapshots`
3. `003-screener-ranking`
4. `004-ticker-workspace`
5. `005-options-conviction`
6. `006-report-income-breakdown`
7. `007-compare-saved`
8. `008-performance-polish`

## Shared Rules

- Every feature updates its own `spec.md`, `tasks.md`, and `notes.md`.
- Later branches may depend on earlier branch infrastructure, but every branch must still build.
- The browser-safe baseline is a local snapshot provider; live APIs are optional overlays, not hard dependencies.
- Options are a soft conviction overlay, not a hard prerequisite for investment labels.
