# DECISIONS.md — running log of choices, spike results, and fallbacks

## T0.1 — Hackathon logistics (16 Nov)
- **Deadline: 19 Nov** (confirmed). Plan unchanged: feature freeze + submit Wed 18 Nov night, Thu 19 = buffer only.
- **Credits:** 10,000 free per account, valid 1 month. Cached replays of passing tests cost 0 credits.
- **Free plan covers everything we need** — `evidence verdict`, `evidence validate`, `--policy-id`, `context ingest` — confirmed in hackathon Slack by the TestMu team (16 Nov).

## T0.2 — Kane CLI setup (16 Nov)
- Installed `@testmuai/kane-cli` globally; logged in via `kane-cli login --oauth` (verified with `kane-cli whoami`).
- Installed the Kane agent skill (`kane-cli install skill`) so Claude Code uses documented flags instead of guessing.
- Smoke run: _pending / result here_

## Kane CLI facts (from skill docs, pre-spike)
- `run` / `testmd run` take `--agent` → NDJSON on stdout. First line is `stream_start`; terminal event is `run_end` (run) / `test_md_done` (testmd).
- Assurance commands (`context ingest`, `design tests`, `cover`, `maintain`) are conversational in a terminal; programmatic use needs `--mode agent` (they refuse `--agent`).
- Suites: `kane-cli testrun run <paths>` with its own stream (`testrun_plan` … `testrun_done`); has `--dry-run` (free validation).
- Exit codes: 0 pass · 1 fail · 2 auth/infra · 3 timeout/cancelled (for assurance commands, 3 = paused-and-resumable).
- Test files must be named `*_test.md`. Designed tests carry an `assurance:` block linking them to requirements; hand-edits get adopted as the next design version → supports our hash-lock anti-cheat.
- `kane-cli evidence verdict --policy <yaml>` can judge an evidence pack against quality gates → candidate to power part of our gate (T3.2). Decision pending.

## T0.4 — Kane output spike
_(pending — record: run_end fields, credits_consumed per run, evidence pack path + layout, whether RCA/fix-prompt text is machine-readable, exit codes observed)_

## T0.5 — Webflow allow-list
_(pending — for each fix type record: possible via Data API yes/no, exact endpoint + method, notes)_
- ALT_TEXT:
- CMS_LINK:
- CUSTOM_CSS:
- PAGE_META (optional):
- Staging publish endpoint + how the staging-only guard works:

## T0.6 — Demo site
_(pending — site URL, the 3 planted bugs and where each lives, site-brief.md written)_

## Stack
- Node 20+ / TypeScript, Hono, vitest, Webflow Data API v2 via fetch, Anthropic SDK for fix planning — PRD defaults, no reason to swap.
