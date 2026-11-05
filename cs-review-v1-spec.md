# CS Review — V1 implementation spec

Date: 2026-11-05  
Target: a separate repository, provisionally `selma0817/cs-review`  
Stack: React + Vite + TypeScript, npm, static GitHub Pages hosting

## 1. Goal and scope

Build a small, usable interview refresher from the supplied `questions.json`. The owner wants to try the experience before deciding which question types to keep. Make types selectable; retain the original bank unchanged.

Success: open the site, select topics/types, practice, reveal feedback, mark items for review, refresh and resume. Work on a local implementation first and supply deployment configuration. This spec does not authorize creating a remote repo, pushing, or publishing; the owner will perform those steps after local review or separately instruct Codex to do so.

No backend, accounts, database service, LLM calls, live GitHub synchronization, code execution, automatic free-text grading, scheduling algorithm, or cross-device sync in V1. A deployed bank and its answers are public static assets; this is a personal study tool, not a secure examination system.

## 2. Inputs and setup

- Owner supplies `questions.json`; place it at `public/questions.json`.
- Optional `questions-review.md` is editorial reference, not runtime input. Store under `docs/` if supplied.
- Original notes remain in `https://github.com/selma0817/cs-knowledge-base`. Do not modify that repository.
- Inspect existing project files and applicable AGENTS.md before scaffolding. Preserve unrelated work.
- If the bank is missing, implement the loader and app with a tiny clearly labeled test fixture, but explicitly report the real bank as missing. Never silently fabricate the 30-question bank.
- Use compatible stable dependencies, pin the Node major in `.nvmrc` and CI, and commit `package-lock.json`. Use React state/reducer and ordinary CSS; no global state framework or large UI kit is necessary.

## 3. Data contract — use the existing shape

The JSON root is an object, NOT an array. It includes `schema_version: "1.0.0"`, `title`, `created_date`, `source_repository`, `source_commit`, `generation_method`, `review_status`, and `questions`.

```ts
type QuestionType = 'single_choice' | 'flashcard' | 'code_reading' | 'short_answer';
type Source = { path: string; heading: string; blob_sha: string; url: string };
type CommonQuestion = {
  id: string;
  version: number;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  question: string;
  answer: string;
  explanation: string;
  sources: Source[];
  review_status: string;
  rubric?: string[];
  extension_note?: string;
  code_language?: string;
};
type Question = CommonQuestion & (
  | { type: 'single_choice'; grading: 'exact_option_id'; options: { id: string; text: string }[] }
  | { type: 'flashcard' | 'code_reading' | 'short_answer'; grading: 'self_assessment' }
);
```

For single-choice questions `answer` contains an option ID such as `B`, not its text or position. Other answers contain reference text. Code fences are embedded in `question`; `code_language` is optional. Source headings are labels; use the supplied URL, not an invented heading anchor. Preserve optional fields and metadata, and accept draft review statuses (do not filter out the whole draft bank).

Use a runtime validator, such as Zod, for required fields and supported schema/types. Reject duplicate IDs, nonpositive/noninteger versions, duplicate option IDs, invalid correct-option references, and unsupported question types. Permit additional metadata. A malformed bank produces an actionable load error rather than a partial silent load. Derive topic/type lists and totals from data; do not hardcode 30 into the UI.

Fetch once on startup using `${import.meta.env.BASE_URL}questions.json`; check HTTP status and JSON validation. Show loading, error + Retry, and empty-bank states. Support editing/replacing the JSON and rebuilding without code changes when the schema remains compatible.

## 4. UI and behavior

English interface and original English question content. Calm, readable light theme, restrained accent color, centered reading area around 800–960px, responsive at 375px and desktop. Code blocks scroll horizontally inside their card without widening the page. Render Markdown, including fenced code, lists and inline code, through a safe Markdown renderer; do not enable raw HTML or use `dangerouslySetInnerHTML`. External links must use safe HTTP(S) URLs and appropriate new-tab rel attributes.

### Setup screen

- Title: CS Review. Short description and total available count.
- Topic checkboxes and type checkboxes, initially all selected; Select all / Clear controls.
- Type labels: Multiple choice, Flashcards, Code reading, Short answer.
- Mode: All matching questions / Needs review only.
- Show matching count; Start review disabled at zero with a clear explanation.
- A Resume button appears for a saved valid session. Changing setup filters does not mutate that session until Start review is clicked. Starting a replacement session retains historical progress.
- No shuffle or session-size selector in V1: use bank order so test behavior is reproducible.
- Small notice: progress is saved in this browser and does not sync between devices.

### Session screen

- Show topic, type, difficulty and `Question X of N`.
- Show the question; keep answer, explanation and rubric hidden initially.
- Previous and Next/Skip allow navigation without grading. Back to setup saves the session. Navigation does not count as an attempt.
- Never auto-advance on submission or self-rating. Users need time to read explanations.
- At the last item, offer Finish session. Summary shows answered versus skipped, correct/incorrect multiple-choice results, and self-ratings separately. Do not mix self-ratings into a purported objective accuracy score.
- Resume a finished session as its summary, with a Start new review action.

### Multiple choice

- Accessible radio group, full option text and a Submit answer button.
- Submit disabled until selection. Selection alone reveals nothing.
- After submission, lock this visit's choice, show Correct/Incorrect, identify selected and correct options with text as well as color, and reveal explanation and sources.
- Save exactly one attempt for this submission. Re-clicking, navigating back, or refreshing must not create another attempt.
- Correct sets latest status to `known`; incorrect sets it to `needs_review`. A later new-session attempt may replace that latest status, but history/counters remain.

### Other three types

- Flashcards: question + Show answer. No required animation.
- Code reading and short answer: optional plain textarea for a draft response, then Show answer. This is not an executable code editor.
- After reveal show reference answer, explanation, rubric if present, sources, and extension note if present.
- Then enable `Got it` / `Needs review`. Reveal alone does not count as an attempt or assign mastery. Clicking a rating records one attempt and locks that visit's rating.
- Show rubric as self-check guidance, never an automated grading result.

### Revisiting and new practice

Within the same session, retain selected options, submitted feedback, draft response, reveal state, and self-rating for each visited question. A new session hides answers and clears these per-visit fields while preserving global progress. Users retry through a new session, not an ambiguous button that changes an existing submission.

The session queue is a snapshot of matching question ID/version pairs at Start. An item marked known during a Needs review session remains in the current queue; the next session reflects updated status. An empty Needs review selection offers All matching questions.

### Accessibility

Use real buttons, labels, fieldsets/radios, keyboard focus indicators, and a polite live region for feedback. On question navigation, focus the question heading. No reliance on color alone. Touch controls should be comfortably tappable. Avoid global keyboard shortcuts in V1 because questions contain textareas.

## 5. Persistence semantics

Keep all learner data outside the question bank. Use a versioned, app-specific localStorage key, for example `cs-review:progress:v1`; never clear unrelated origin storage (other GitHub Pages apps share the origin).

Store:

- `storageVersion`, bank identity from source repository + bank title, and observed source commit.
- Question records keyed by ID and version, with attempts count, correct count for multiple choice, latest status (`known` / `needs_review`), latest timestamp, and latest outcome.
- Settings: selected topics/types and mode.
- Current session: ordered ID/version pairs, cursor, per-visit fields, finished flag and session ID.

Use immutable updates/a reducer so selection and submission transitions cannot accidentally double-count. Persist after meaningful actions and draft edits (a short debounce is acceptable, but flush when leaving the question). Load once and validate stored data before using it.

On a bank update, preserve records for unchanged ID/version pairs. Ignore obsolete versions for current statistics; a new version is unseen. Remove unavailable ID/version pairs from a resumed queue, clamp its cursor, and explain when a saved session can no longer be resumed. A source commit change alone must not reset all progress. Sanitize stale filter values against the new bank.

Storage missing: start clean. Invalid/corrupt storage: show a brief recovery notice and start clean without crashing. Storage blocked or quota exceeded: keep an in-memory session and show that changes cannot be saved. Include a Reset progress control with explicit confirmation, clearing only this app's key. Export/import, multi-tab merging and cross-device persistence are deferred.

## 6. Suggested implementation layout

```text
public/questions.json
src/App.tsx
src/types.ts
src/lib/questionBank.ts
src/lib/progress.ts
src/lib/session.ts
src/components/SetupScreen.tsx
src/components/QuestionCard.tsx
src/components/AnswerFeedback.tsx
src/components/SessionSummary.tsx
src/styles.css
tests/
e2e/
.github/workflows/ci.yml
.github/workflows/deploy.yml
vite.config.ts
package.json
package-lock.json
README.md
```

Equivalent small modules are fine. Prefer a single page with internal screen state; no pathname router or server fallback. Keep filtering, scoring and progress transitions testable independently of rendering.

## 7. GitHub Pages delivery

Default project-site base is `/cs-review/`. Make the base configurable via a documented build setting such as `VITE_BASE_PATH`; use the configured Vite base for fetches/assets. A root/custom-domain deployment may use `/`. Do not hardcode `/questions.json`. The production preview must work under `/cs-review/`, not merely the dev root.

Provide separate workflows:

1. CI on pull requests and main pushes: install with `npm ci`, type-check, validate bank, run unit/component tests and build. Include a Chromium production-preview smoke test.
2. Deployment initially via `workflow_dispatch` on main only, after checks succeed. Build `dist`, upload the Pages artifact, deploy with GitHub's Pages actions, use the `github-pages` environment and expose its resulting URL. Set read-only repository contents permission and Pages/OIDC write permission only where needed. Configure deployment concurrency. No PAT or API key is needed.

Verify current official action releases when implementing and pin explicit supported versions or commit SHAs; do not guess versions from memory. README should explain optional push-to-main deployment later, after the owner has reviewed the site.

README must include local install/dev commands, test commands, production preview URL, expected Node version, how to replace the bank, base-path changes if the repo is renamed, and deployment steps: create/push to the new repo, select GitHub Actions in Settings → Pages, run Deploy from main, then inspect the workflow URL. Report separately what was tested locally and what has actually been deployed.

## 8. Required verification

Provide scripts: `dev`, `typecheck`, `validate:bank`, `test` (nonwatch), `test:e2e`, `build`, `preview`.

Use focused Vitest/Testing Library tests for the important behaviors and a small Playwright Chromium smoke suite. Avoid snapshot-only tests or exhaustive cosmetic tests.

| Check | Acceptance criterion |
|---|---|
| Bank loading | Real bank parses; topics/types generated; malformed bank has Retry/error UI |
| Filtering | Combined topic/type/mode intersection is correct; no matches disables Start |
| Multiple choice | No answer before Submit; answer compared by option ID; wrong/correct feedback correct |
| Double counting | Submit once, navigate away/back and reload: attempt count remains one |
| Self-assessment | Reveal alone leaves progress unchanged; rating records one outcome |
| Resume | Refresh restores cursor, draft, reveal/submission and locked state |
| Queue stability | Marking an item known does not remove it from the current Needs review queue |
| New session | Feedback hidden again while historical progress persists |
| Bank versions | Changed question version is unseen; unchanged versions retain progress |
| Storage failure | Malformed JSON and storage exceptions do not crash the app |
| Reset | Confirmation required; only app-owned progress removed |
| Hosting | Built app and JSON load under `/cs-review/`; refresh works |
| Rendering | Code formatting preserved; unsafe HTML/URLs not executed |

For production E2E: build, launch `vite preview`, visit `/cs-review/`, answer an MCQ, reload, check retained result, and exercise one self-assessed item. Check at desktop and 375px widths for page overflow and usable controls. If the local environment cannot run a browser, state that clearly and leave exact commands/manual checks; do not claim a browser test passed.

### Owner's manual trial (about 10 minutes)

1. Start with all topics/types. Confirm the supplied bank shows 30 questions.
2. Select Go concurrency + Multiple choice: this starter bank should show 3.
3. Answer one incorrectly. Read the explanation, then refresh and check it is retained.
4. Start a Needs review session with the same filters; check the incorrect item appears.
5. Start a new Code reading session; verify Go code is readable, type a draft, reveal the answer and self-rate.
6. Try a Flashcard and a Short answer. Decide which types feel useful; disable others in setup without deleting them.
7. Navigate Previous/Next and confirm feedback is retained within the session.
8. Finish with some skipped items and check the summary distinguishes them.
9. Resize to mobile width and check controls/code blocks.
10. Check production preview under the repository prefix before enabling Pages; repeat basic loading and refresh checks on the deployed URL.

## 9. Codex execution sequence and handoff

Implement in four checkpoints without stopping for routine design questions:

1. Inspect inputs, scaffold, validate/load the real bank, show setup and a readable question.
2. Implement question interactions, filtering and session summary.
3. Add persistence, resume, reset and focused tests.
4. Add CI/deployment files, README and production-prefix smoke verification.

Deliver working local source, lockfile, workflows, and a concise completion report: changes made, commands/results, local preview URL, outstanding limitations and exact owner deployment steps. Do not claim GitHub Pages is live unless deployment has actually succeeded. Keep existing question wording/IDs intact; report content concerns separately.


## References checked for deployment

- Vite static deployment and repository base paths: https://vite.dev/guide/static-deploy.html#github-pages
- GitHub Pages custom workflows and deployment permissions: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

The Pages setup above is a deployment design, not a statement that this repository or website already exists.
