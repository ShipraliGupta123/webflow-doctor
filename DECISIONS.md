# DECISIONS.md — running log of choices, spike results, and fallbacks

## T0.1 — Hackathon logistics (16 Nov)
- **Deadline: 19 Nov** (confirmed). Plan unchanged: feature freeze + submit Wed 18 Nov night, Thu 19 = buffer only.
- **Credits:** 10,000 free per account, valid 1 month. Luma page says cached replays of passing tests cost 0 credits (not yet verified).
- **Free plan covers everything we need** — `evidence verdict`, `evidence validate`, `--policy-id`, `context ingest` — confirmed in hackathon Slack by the TestMu team (16 Nov).

## T0.2 — Kane CLI setup (16 Nov)
- Installed `@testmuai/kane-cli` globally; logged in via `kane-cli login --oauth` (verified with `kane-cli whoami`).
- Installed the Kane agent skill (`kane-cli install skill`) so Claude Code uses documented flags instead of guessing.
- Smoke run: done 16 Nov (spike-run.ndjson). Failed on a stale expectation (example.com
  heading changed) — which usefully exercised Kane's verdict/triage output. See T0.4.

## Kane CLI facts (from skill docs, pre-spike)
- `run` / `testmd run` take `--agent` → NDJSON on stdout. First line is `stream_start`; terminal event is `run_end` (run) / `test_md_done` (testmd).
- Assurance commands (`context ingest`, `design tests`, `cover`, `maintain`) are conversational in a terminal; programmatic use needs `--mode agent` (they refuse `--agent`).
- Suites: `kane-cli testrun run <paths>` with its own stream (`testrun_plan` … `testrun_done`); has `--dry-run` (free validation).
- Exit codes: 0 pass · 1 fail · 2 auth/infra · 3 timeout/cancelled (for assurance commands, 3 = paused-and-resumable).
- Test files must be named `*_test.md`. Designed tests carry an `assurance:` block linking them to requirements; hand-edits get adopted as the next design version → supports our hash-lock anti-cheat.
- `kane-cli evidence verdict --policy <yaml>` can judge an evidence pack against quality gates → candidate to power part of our gate (T3.2). Decision pending.

## T0.4 — Kane output spike (16 Nov, spike-run.ndjson committed)
- NDJSON event order: stream_start → recording_state → bifurcation → progress events
  ({step,status,remark}, no "type") → coverage → run_end (terminal). CLI v0.10.4.
- **RCA is machine-readable**: run_end.verdict = {root_cause, suggestion, bug_title, family,
  category, severity, confidence, culprit_step, relevant_steps, agent_fault_assessment}.
  Diagnosis (FR-3) builds directly on this; DOM-scraping fallback likely unnecessary.
- verdict.family distinguishes site bugs from test/automation bugs — our loop should only
  attempt fixes when Kane blames the site, not the test.
- Cost: ~12.6 credits/run (incl. ~2.9 verdict triage) → 10k credits ≈ ~790 runs. 40-run cap fine.   Multi-step designed tests likely cost more per run — re-measure on the baseline.
- Evidence pack: ~/.testmuai/kaneai/sessions/<session>/evidence/<id>.evidence
  (paths also in run_end.session_dir / run_dir). Exit code 1 on failed assertion.
- coverage event: skipped with "not_assurance_project" → only designed tests get coverage.
- context.memory gives per-check extracted_value vs expected_value.
- test_url: per-run shareable Test Manager dashboard link.

## T0.5 — Webflow fix surfaces (17 Nov, confirmed while building via Webflow MCP)
- **ALT_TEXT: possible.** Hero img inherits alt from asset `6afb70b5f814d42288f41ade`
  (no element-level override) → fix = `PATCH /v2/assets/{assetId}` with `{altText}`.
  Currently renders `alt=""` (bug 1 live).
- **CMS_LINK: possible.** Fix = `PATCH /v2/collections/6afbef72ddd8aeed2da51e10/items/{itemId}`
  (Travel Press item `6afbf088f45b0ed3cc52f6e5`, field slug `buy-link`), then publish items
  via `POST .../items/publish`.
- **CUSTOM_CSS: possible via registered scripts only.** Freeform custom-code API returns
  404 on this plan (both page- and site-level). Registered scripts work:
  `POST /v2/sites/{siteId}/registered_scripts/inline` to register, apply via
  `PUT /v2/sites/{siteId}/custom_code`. Gotcha: the incremental add (`add_site_script`)
  404s with "custom code block not found" until a block exists — the replace-all PUT
  creates it. Fix = inject overriding CSS via a registered inline script (or remove the
  offending script).
- **Staging publish:** `POST /v2/sites/{siteId}/publish` with
  `{publishToWebflowSubdomain: true}`. The demo site has NO custom domains, so publishes
  physically cannot reach production. `webflow/client.ts` guard will additionally refuse
  any call with a non-empty customDomains list.
- Open item: re-verify these endpoints with the site API token — the MCP build used the
  Claude↔Webflow connector's OAuth, the shipped app uses the token.

## T0.6 — Demo site (17 Nov)
- **Live:** https://webflow-doctor-demo.webflow.io
  (site id `6afb6f3f015a6fa143a72dc5`, Home page id `6afb6f40015a6fa143a72dd0`)
- Structure: hero (H1 "Brewed — small-batch coffee gear", image, `.cta-button` "Shop now"
  → `#products`), CMS-bound products grid (3 items), "Get in touch" footer.
- **Bug 1 (ALT_TEXT):** hero image renders `alt=""` (asset-inherited). Verified in DOM.
- **Bug 2 (CMS_LINK):** Travel Press Buy → `https://webflow.com/404-this-page-is-gone`.
    Verified 17 Nov: URL returns HTTP 404 (no redirect); the other two Buy links return 200.
- **Bug 3 (CUSTOM_CSS):** registered script `ctahidebug` v0.0.1 in site header injects
  `@media (max-width:390px){.cta-button{display:none}}`. Verified at 390px in DevTools.
- Built with: CMS collection + items + hero by hand in Designer; collection list,
  CMS bindings, footer, bug planting, and publish via the Webflow MCP connector.
- `site-brief.md` written to match the intended (fixed) behavior.

## T1.2 — Flows designed from site-brief.md (17 Nov)
- Used Kane's assurance pipeline, no hand-written flows: `context ingest site-brief.md` →
  3 use-cases → `design tests` per use-case → 5 designed tests in `.testmuai/tests/`.
  Cost: ~63 credits for the whole requirements → tests stage.
- Chose "work locally" (local `.context/` store, gitignored); test files are committed.
- Tests live in `.testmuai/tests/` (Kane's default), NOT `tests/` — runner and the
  hash-lock anti-cheat point there.
- Use-cases must be approved before `design tests` runs; approved all ACs/scenarios/tests
  with `kane-cli context review --approve <ids>` (the review screen's keys were awkward).
- Steered Kane to split UC-2 into 3 scenarios (mobile CTA / alt text / desktop) so each
  planted bug fails exactly one test — required for per-fix gating.
- Kane's agent didn't write its alt-text removal back to disk for t-2/t-3; removed those
  steps by hand (designed-test edits are adopted as the next design version).
- Bug → test map: bug 2 → t-1 (Buy links), bug 3 → t-2 (mobile CTA 390/389px),
  bug 1 → t-4 (alt text). t-3 (desktop) and t-5 (footer) are expected to pass.

## T1.4 — Baseline findings & bug-3 swap (17 Nov)
- **Kane web runs ignore `config set-window`.** Step screenshots are always 1920×1080 —
  visible, headless, and after `set-window 390x844`. A test step saying "open at 390px"
  is executed as a plain wait. Kane's mobile targets drive native apps only, not URLs.
  → Mobile-viewport bugs are undetectable on this setup. (Asked in Slack.)
- **Fallback (PRD rule 9 / Section 6 — change the bug, not the architecture):** bug 3 is now
  `CUSTOM_CSS` hiding the footer contact link: registered script `footerhidebug` v0.0.1
  injects `.footer-link{display:none}`. Old `ctahidebug` removed from the site (still
  registered, not applied). Caught by t-5 (footer test).
- **Mobile test t-2 excluded from the suite**: it can't run at 390px, so a pass would
  claim coverage it doesn't have. Kept on disk; listed as a known limitation in README.
- **Replay vs author:** a second run of a passed test *replays* recorded actions — ~0
  credits, ~13s — but replay re-checks "present", not "visible" (a `display:none`
  element passes). `--author` re-runs every step against the live page. → The loop
  verifies the target flow with `--author`; the regression set can replay.
- `--author` rewrites the `base:` hash in the test frontmatter → the hash-lock anti-cheat
  must hash the step bodies, not the whole file.
- **Assertion wording decides Kane's verdict family.** Checking the footer link's *href*
  on a hidden link → `automation_bug` (Kane blamed itself). Rewording t-5 step 2 to
  "assert the link is **visible** and points to mailto:…" → `application_issue`, with a
  bug title and a fix suggestion. Assert what the visitor sees.
- **Real cost:** one fresh 5-test suite run ≈ 239 credits (24–76 per test); a single
  fresh test ≈ 30–40. Budget the loop per test, not per suite.
- First run's Buy-links failure was Kane's own `agent_misstep` on a working link —
  confirms we need FR-2's reruns plus the verdict.family check.

- **Confirmed red baseline (17 Nov, evidence/baseline-red/):** 4-test run, 3 red / 1 green
  (~158 credits), then reruns after fixing test wording. Final state:
  bug 2 → t-1 step 4 (Travel Press) `application_issue/navigation_defect` 0.99;
  bug 1 → t-4 step 2 (empty alt) `application_issue/ui_data_defect` 0.98;
  bug 3 → t-5 step 2 (hidden link) `application_issue/ui_state_mismatch` 0.94;
  t-3 desktop passes.
- **Rule for test wording: each assertion is one plain, observable fact.** Every test
  first failed for the wrong reason until reworded: "href is mailto:…" → "link is
  *visible* and points to…"; "alt is non-empty *and describes* the image" → split into
  a DOM fact step + a judgement step; "destination *loads as a page* rather than a 404"
  → Kane decomposed it into "a page *about Burr Grinder* is present" and falsely
  failed 3× → "the page that opens does not show a 404 / page not found / error".
- Burr Grinder's Buy link changed `webflow.com/pricing` → `webflow.com` (healthy control
  data; turned out not to be the cause — the wording was).
- **`verdict.family` is not stable for the same failure** (alt-text: application_issue
  in one run, automation_bug in another). Gate decides on pass/fail + failing step;
  family/root_cause are used only as diagnosis input, never as the verdict.
- Event names differ by mode: `testrun_authored_member_end` (replay run) vs
  `testrun_member_end` (`--author` run). Runner must accept both.

## Stack
- Node 20+ / TypeScript, Hono, vitest, Webflow Data API v2 via fetch, Anthropic SDK for fix planning — PRD defaults, no reason to swap.
