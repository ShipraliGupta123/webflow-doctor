# Webflow Doctor — PRD & Build Spec

**Kane CLI finds it. An agent fixes it. Kane proves it.**

- Event: Kane CLI Online Hackathon (TestMu AI) — Lane 1 (apps that verify themselves) + Lane 4 (requirements that test themselves)
- Team: solo (Shiprali) + Claude Code
- Build window: Mon 16 Nov → **Wed 18 Nov 22:00 IST = feature freeze + submitted**. Thu 19 Nov = buffer only (fresh-clone test, fixes, resubmit). No new features on the 19th.
- Deadline caveat: the Luma page contradicts itself on dates. Confirm the real deadline in Slack (task T0.1). Plan assumes submission by Wed night regardless.

---

## 0. For Claude Code — read this first

**Goal:** build a web app + CLI that tests a Webflow *staging* site with Kane CLI, applies an allow-listed fix through the Webflow API, and has Kane re-verify. A fix counts only if Kane's re-run passes.

**Rules**
1. **Kane is the judge, the agent is the hands.** Never let the LLM decide whether a fix worked. Only Kane results do.
2. **Work milestone by milestone** (Section 9). Finish and commit each task's acceptance criteria before moving on.
3. **Commit early and often** (at least 2 meaningful commits per day, small messages). The hackathon checks commit history; the repo must be initialized on/after 12 Nov.
4. **Staging only.** Never publish to production or a custom domain. Publish to the `webflow.io` subdomain only.
5. **The fixer must never edit test files** (`tests/*_test.md`) or the Kane config. Enforce with a hash check (Section 8).
6. **No secrets in git.** Use `.env` (see `.env.example`).
7. **Don't guess Kane flags.** Run `kane-cli --help` and `kane-cli <command> --help`, and read https://testmuai.com/kane-cli/agents.md. Optionally run `npx @testmuai/kane-cli-skill` to teach the coding agent the Kane commands.
8. **Every Kane run leaves evidence** under `evidence/<run-id>/` and is committed.
9. If a task is blocked >45 min, apply the fallback listed for it, note it in `DECISIONS.md`, and move on.
10. Keep `README.md` accurate at the end of each milestone. Judges read it.

**Default stack (swap only with a reason):** Node 20+ / TypeScript, Hono or Express, one static HTML page + SSE for live progress, `vitest`, Webflow Data API v2 via the official JS SDK or plain `fetch`, Anthropic SDK for the diagnose/fix-planning step.

**Suggested first prompt:** *"Read PRD.md fully. Start at M0 and do T0.3 onward. Ask me only for things marked 'You'."*

---

## 1. Product

**Problem.** Freelancers and small agencies ship many Webflow sites and QA them by hand-clicking before handoff. Kane's assurance loop proves what's broken and hands a human a fix prompt, but a Webflow site has no repo to paste that prompt into.

**Solution.** Point Webflow Doctor at a Webflow staging site. It:
1. Turns a short site brief into plain-English Kane flows (`_test.md` files).
2. Runs them with Kane CLI, producing a 0–100 score, video traces and evidence packs.
3. Sends Kane's diagnosis to an agent, which proposes a fix from a fixed allow-list.
4. Applies the fix through the Webflow API and republishes to staging.
5. Re-runs Kane. The fix is accepted only if the failing flow passes **and** previously-passing flows still pass.

**Users.** Webflow freelancers and agencies (primary). Small businesses via those agencies (later).

**Non-goals (this week).** Accounts, billing, multi-tenant, production publishing, arbitrary Designer-level layout edits, mobile-device testing (stretch), auto-crawling every page (stretch).

**One-liner for the README:** *Kane finds it. An agent fixes it. Kane proves it.*

---

## 2. Hackathon alignment

| Judging dimension | How we hit it | Evidence to show |
|---|---|---|
| **Ships** | Web app + CLI, one-command run, seeded demo site, demo mode | README quickstart, live URL or `npm run demo` |
| **Verified** | Kane exercises the real site, catches 3 planted bugs, confirms fixes | Red run + green run in `evidence/`, video traces |
| **Closed loop** | Kane fails → agent reads diagnosis → fixes via API → Kane re-runs | Orchestrator log + the fail→pass moment in the video |
| **Craft** | Gate + anti-cheat, Webflow-specific remediation, `_test.md` suite becomes permanent CI tests | Gate rejecting a bad fix on camera, CI badge |

**Rules compliance checklist**
- [ ] Repo initialized on/after 12 Nov, public, README with setup steps
- [ ] Signed up at testmuai.com and ran Kane CLI (eligibility)
- [ ] Kane runs through a paired channel too (MCP tool and/or GitHub Actions), not only the terminal
- [ ] Working credentials or a demo mode for judges (third-party dependency fallback: recorded run + backup deploy)
- [ ] 3-minute demo video, **Unlisted**, tested in incognito, interesting part first
- [ ] One-paragraph write-up: what, who, which agent, what Kane does
- [ ] Live URL or one runnable command (judges should see it working in <30 s)

---

## 3. Requirements

### Functional
| ID | Requirement |
|---|---|
| FR-1 | **Spec → flows.** Ingest `site-brief.md` with Kane context commands and generate `_test.md` flows via `kane-cli design tests`. Fallback: 3–5 hand-written `_test.md` flows. |
| FR-2 | **Run & score.** Run every flow with `kane-cli testmd run`, parse results, compute a 0–100 score (weighted by flow severity). Re-run failures up to 3× to absorb flakiness. |
| FR-3 | **Diagnose.** For each failing flow, collect the failed step, Kane's root-cause output / fix prompt (if exposed), screenshot, and relevant page DOM into a `Diagnosis` object. |
| FR-4 | **Fix.** An LLM selects one fix from the allow-list and fills its parameters. Deterministic executors apply it via the Webflow API. Snapshot the previous value first. |
| FR-5 | **Publish to staging.** Publish only to the `webflow.io` subdomain after a fix. |
| FR-6 | **Gate.** Re-run Kane. Accept only if the target flow passes AND all baseline-passing flows still pass AND anti-cheat checks pass. Otherwise roll back from the snapshot. |
| FR-7 | **Evidence.** Persist every run under `evidence/<run-id>/` (Kane output, evidence pack, video links, diagnosis, fix, gate verdict, score). |
| FR-8 | **Interfaces.** (a) CLI `doctor`, (b) MCP tool `verify_with_kane`, (c) minimal web UI, (d) GitHub Actions workflow. |
| FR-9 | **Demo mode.** `npm run demo` replays a recorded verified run with no Kane credits or Webflow token needed. |

### Non-functional
- **Safety:** allow-listed fix types only; staging only; snapshot + rollback; max 3 fix attempts per flow; no deletions.
- **Budget:** cap Kane runs per session (default 40); cache and replay passing flows.
- **Determinism:** same inputs → same gate verdict; test files hash-locked during a loop.
- **Observability:** structured JSON logs; every decision written to the run folder.
- **One-command run:** `npm install && npm run dev`.

---

## 4. Architecture

```
site-brief.md ──► Kane context/design ──► tests/*_test.md
                                              │
Webflow staging site ◄── publish ◄─┐          ▼
        ▲                           │   [Runner] kane-cli testmd run ──► results + evidence pack
        │ Webflow Data API          │          │
        │                           │          ▼
   [Fixer executors] ◄── [Fix planner (LLM)] ◄── [Diagnoser]
        │                                         
        └──► [Orchestrator + Gate] ──► re-run Runner ──► verdict ──► evidence/<run-id>/
                                                         │
                                           UI (SSE) · CLI · MCP tool · CI
```

**Repo layout**
```
/PRD.md                  this file
/DECISIONS.md            running log of choices and fallbacks
/README.md
/.env.example
/site-brief.md           requirements for the demo site (Kane input)
/tests/*_test.md         Kane flows (hash-locked during loops)
/src/
  runner/                kane.ts (spawn CLI, parse NDJSON/output), score.ts
  diagnose/              diagnose.ts
  fix/                   planner.ts, executors/{altText,cmsLink,customCss,...}.ts, snapshot.ts
  webflow/               client.ts (Data API wrapper, staging-only guard)
  loop/                  orchestrator.ts, gate.ts, antiCheat.ts
  mcp/                   server.ts (verify_with_kane)
  cli/                   doctor.ts
  server/                app.ts (API + SSE), public/index.html
/evidence/<run-id>/      committed run artifacts
/demo/                   recorded verified run for demo mode
/.github/workflows/kane.yml
```

**Core types (sketch)**
```ts
type FlowResult = { id: string; name: string; weight: number; status: 'pass'|'fail'|'error';
  attempts: number; durationMs: number; failedStep?: string; rca?: string;
  screenshot?: string; videoUrl?: string; evidencePack?: string };
type RunSummary = { runId: string; score: number; flows: FlowResult[]; credits?: number };
type Diagnosis = { flowId: string; failedStep: string; rca?: string; fixPrompt?: string;
  domSnippet?: string; screenshot?: string };
type FixPlan = { type: 'ALT_TEXT'|'CMS_LINK'|'CUSTOM_CSS'|'PAGE_META'; params: Record<string,unknown>;
  rationale: string };
type GateVerdict = { accepted: boolean; reasons: string[]; before: RunSummary; after: RunSummary };
```

---

## 5. Kane CLI integration notes

**Known from the hackathon page and public Kane/previous-winner docs**
- Install: `npm install -g @testmuai/kane-cli`; log in with `kane-cli login --oauth`.
- Assurance commands: `kane-cli context ingest ./brief.md` → `kane-cli context extract` → `kane-cli context list` → `kane-cli design tests` (writes `_test.md` files, e.g. under `.testmuai/tests/` or the folder you pass).
- Run: `kane-cli testmd run ./tests/<name>_test.md`. A previous winner used `--agent --headless --variables-file <json>`.
- Variables file format: `{ "name": { "value": "...", "secret": false } }`.
- `kane-cli maintain` reconciles the suite with changed requirements. Playwright export is built in.
- The hackathon page says agents can read Kane's **NDJSON** output.
- Don't run multiple standalone `testmd` processes on the default Chrome port; serialize runs.
- Docs: https://www.testmuai.com/support/docs/kane-cli-introduction/ · agent skills: https://testmuai.com/kane-cli/agents.md · cookbook: https://www.testmuai.com/kane-cli-cookbook/

**To verify first (task T0.4) — do not assume**
- What exactly `testmd run` prints (NDJSON schema), exit codes, where evidence packs/videos are written.
- Whether RCA text and the "fix prompt" are exposed in CLI output or only in the evidence file.
- Whether `design tests` works on free credits and how many credits it burns.
- Whether Exploration is available on free credits (stretch only).
- Mobile (simulator/emulator) availability (stretch only).

**Fallbacks:** if RCA/fix prompt isn't machine-readable → build `Diagnosis` from failed step + screenshot + DOM. If `design tests` is unavailable/expensive → hand-write `_test.md` flows and say so honestly in the README.

---

## 6. Webflow integration notes

- Use a **site API token** for a dedicated demo site. Wrap all calls in `webflow/client.ts`, which refuses to publish anywhere except the `webflow.io` subdomain.
- Claude Code may use the Webflow MCP/Designer to *seed* the demo site; the shipped app uses the Data API.
- **Fix allow-list (finalize in T0.5 after the spike):**

| Fix type | Likely API surface | Planted bug it covers |
|---|---|---|
| `ALT_TEXT` | update asset alt text | Hero/product image missing alt |
| `CMS_LINK` | update CMS item field | Dead link in a CMS-bound CTA / rich text |
| `CUSTOM_CSS` | register + apply inline custom code on site/page | Mobile CTA hidden at ≤390px |
| `PAGE_META` | update page title/SEO | Optional 4th bug (only if time) |

- **Known limit:** layout/element edits made in the Designer may not be reachable through the Data API. **Change the planted bugs to match what's fixable — never change the architecture.** (Static-element link/form fixes are probably out; confirm in the spike.)
- Record the exact endpoints used in `DECISIONS.md` once confirmed.

---

## 7. Loop algorithm

```
baseline = run_all(flows)                      # red run, committed to evidence/
queue = failing flows ordered by severity (RCA confidence if available)
for flow in queue:
  for attempt in 1..3:
    diag = diagnose(flow)
    plan = planner(diag)                       # must pick from allow-list, else abort flow
    snap = snapshot(plan)                      # store previous value
    apply(plan); publish_staging()
    after = run(flow) + run(regression_set)    # regression_set = flows that passed in baseline
    verdict = gate(baseline, after, plan)      # Section 8
    log(verdict)
    if verdict.accepted: baseline = after; break
    rollback(snap); publish_staging()
final = run_all(flows); report(before_score → after_score)
```

---

## 8. Gate and anti-cheat (the differentiator)

**Accept a fix only if all hold:**
1. The target flow passes (majority of up to 3 runs).
2. Every flow that passed in the baseline still passes.
3. `tests/` and Kane config hashes are unchanged since loop start.
4. The fix type is on the allow-list and its params pass schema validation.
5. The fix didn't remove/hide the element or content the flow asserts on (compare before/after DOM for the asserted selectors/text; reject deletions and `display:none` on asserted elements).
6. The fix didn't weaken the flow (no edits to tests, no new custom code that special-cases the Kane user agent or test URLs).
7. Credit budget not exceeded.

**On reject:** roll back from snapshot, republish staging, log reasons, try the next attempt. After 3 rejects, mark the flow "needs human" in the report.

---

## 9. Project plan

Owners: **You** = Shiprali, **CC** = Claude Code. Estimates are hours. "Cut line" tasks are dropped first if behind.

### M0 — Setup and spikes · Mon 16 Nov, 12:45–15:30
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T0.1 | Ask in Slack: real deadline; credit limits; whether `design tests` and evidence packs work on free credits | You | 0.2 | Answer noted in `DECISIONS.md` |
| T0.2 | Sign up at testmuai.com; `npm i -g @testmuai/kane-cli`; `kane-cli login --oauth`; run one example flow | You | 0.5 | One Kane run completes |
| T0.3 | Create public repo, add this PRD, `.env.example`, scaffold; first commit | CC | 0.3 | Repo initialized today, PRD committed |
| T0.4 | **Kane spike:** run `testmd`; document output format, exit codes, evidence/video paths, RCA availability | CC | 0.8 | `DECISIONS.md` section "Kane output" |
| T0.5 | **Webflow spike:** create API token; confirm which fixes are possible (alt text, CMS item, custom code, publish to staging); finalize allow-list | You + CC | 0.8 | Allow-list and endpoints in `DECISIONS.md` |
| T0.6 | Build demo Webflow site on `webflow.io` with 3 planted fixable bugs + `site-brief.md` | You (CC via Webflow MCP if useful) | 1.0 | Site live; bugs reproducible |

### M1 — Kane runner and red baseline · Mon 16 Nov, 15:30–21:00
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T1.1 | `runner/kane.ts`: spawn CLI, serialize runs, parse output into `FlowResult` | CC | 1.5 | Unit test with a recorded output sample |
| T1.2 | Flows as `_test.md`: try `context ingest`/`design tests` on `site-brief.md`; fall back to 3 hand-written flows (one per bug) | CC + You | 1.0 | 3+ flows in `tests/`, each runnable |
| T1.3 | `runner/score.ts`: weighted 0–100 score, flake handling (up to 3 reruns) | CC | 0.7 | Score computed from sample results |
| T1.4 | **Baseline red run** against the demo site; commit to `evidence/`; screen-record it (this is the demo opening) | CC + You | 0.8 | Score < 100, 3 failing flows, videos saved |

### M2 — Diagnose and fix · Tue 17 Nov, 09:00–14:00
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T2.1 | `webflow/client.ts` with staging-only publish guard | CC | 0.7 | Test: publishing to a non-staging target throws |
| T2.2 | `diagnose.ts`: failed step + RCA/fix prompt (if available) + screenshot + DOM snippet → `Diagnosis` | CC | 1.0 | Diagnosis object for each baseline failure |
| T2.3 | `fix/executors/*` for the allow-list (alt text, CMS link, custom CSS) + `snapshot.ts` + rollback | CC | 2.0 | Each executor applies and rolls back on the demo site |
| T2.4 | `fix/planner.ts`: LLM picks fix type + params via schema-constrained output; rejects anything off-list | CC | 1.0 | Planner returns valid `FixPlan` for each diagnosis |

### M3 — Closed loop and gate · Tue 17 Nov, 14:00–22:00 · **HARD CHECKPOINT**
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T3.1 | `loop/orchestrator.ts` per Section 7 | CC | 2.0 | Runs end to end on the demo site |
| T3.2 | `loop/gate.ts` + `antiCheat.ts` per Section 8 | CC | 1.5 | Unit tests: accepts a good fix, rejects a deleting fix, rejects a test-file edit |
| T3.3 | Evidence writer: everything under `evidence/<run-id>/` | CC | 0.7 | Folder complete and committed |
| T3.4 | **First full fail→pass run committed** (score before → after) | CC + You | 1.0 | Evidence folder shows red → green with gate verdicts |

**Checkpoint rule:** if T3.4 isn't done by Tue 22:00, drop the UI (T4.1) and ship CLI + video. The loop is what scores.

### M4 — Interfaces and CI · Wed 18 Nov, 09:00–14:00
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T4.1 | Minimal web UI: URL input, live progress (SSE), score before/after, flow list, video links, fix diff | CC | 2.0 | Judge can run it in <30 s *(cut line if behind)* |
| T4.2 | MCP tool `verify_with_kane` returning structured results | CC | 1.0 | Callable from Claude Code |
| T4.3 | GitHub Actions: run Kane flows on push, badge in README (verified channel) | CC | 1.0 | One green workflow run |
| T4.4 | Playwright export of passing flows → committed to repo *(cut line)* | CC | 0.7 | Exported file runs or is shown in README |
| T4.5 | Demo mode: `npm run demo` replays recorded run, no credits/token | CC | 0.8 | Works on a fresh clone with no secrets |

### M5 — Package and submit · Wed 18 Nov, 14:00–22:00
| ID | Task | Owner | Est | Acceptance |
|---|---|---|---|---|
| T5.1 | README: what/why, quickstart, loop diagram, lane fit, honest limits, Kane usage | CC | 1.0 | Fresh reader can run demo mode |
| T5.2 | Record 3-min demo (Section 10); upload **Unlisted**; test in incognito | You | 1.5 | Link plays logged out |
| T5.3 | One-paragraph write-up | You + CC | 0.3 | Mentions Kane's role, agent used, who it's for |
| T5.4 | Fresh-clone test on a clean folder | You | 0.5 | Install + demo mode works from scratch |
| T5.5 | **Submit** via https://www.surveymonkey.com/r/kane-cli-hackathon-submission | You | 0.3 | Confirmation received **Wed night** |

### Thu 19 Nov — buffer only
Fix breakages found by incognito/fresh-clone tests, resubmit if the form allows, publish blog + X post. **No new features.**

---

## 10. Demo script (3 minutes, Kane first)

1. **0:00–0:30** Kane runs on the broken staging site → red; show video trace, failed steps, score.
2. **0:30–1:15** Kane's diagnosis → agent proposes an allow-listed fix → applied via Webflow API → staging republished.
3. **1:15–2:00** Kane re-runs → green; score jumps. Show the gate **rejecting** a bad fix (e.g. one that hides the broken element).
4. **2:00–2:40** Evidence pack, committed `_test.md` suite, CI badge.
5. **2:40–3:00** Architecture slide with Kane at the center; one line on who it's for.

---

## 11. Risks and fallbacks

| Risk | Mitigation |
|---|---|
| Webflow API can't fix a planted bug | Change the bug, not the architecture (T0.5 decides) |
| Kane output/RCA not machine-readable | Build `Diagnosis` from failed step + screenshot + DOM |
| `design tests` unavailable or credit-heavy | Hand-written `_test.md` flows; state it honestly |
| Flaky Kane runs | Up to 3 reruns, majority verdict |
| Credits run out | Cap runs, replay cached passes, ping Slack early |
| Webflow/network problems at judging | Demo mode + recorded run + backup deploy |
| LLM "fixes" by cheating | Gate + anti-cheat (Section 8) |
| Falling behind | Cut line: T4.4, then T4.1; never cut M3 |

---

## 12. Definition of done
- [ ] Red baseline and green final run both committed in `evidence/`
- [ ] Gate demonstrably rejects at least one bad fix
- [ ] `tests/*_test.md` committed and runnable
- [ ] CI run green on GitHub Actions
- [ ] README accurate, demo mode works from a fresh clone
- [ ] Demo video (Unlisted, ≤3:00) and one-paragraph write-up ready
- [ ] Submitted by Wed 18 Nov, 22:00 IST
