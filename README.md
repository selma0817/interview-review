# Interview Concepts Review

A local-first React/Vite interview refresher. It loads the supplied static question bank, supports all four bank question types, and stores progress only in this browser. There is no backend or account sync.

The setup page shows overall and per-topic completion. Use **Practice new questions** for unseen questions or **Review marked questions** for questions you explicitly marked. Both respect the selected topics/types and shuffle once when the session starts; a saved session keeps its order. Multiple-choice submissions track correct and incorrect history. Every other type uses the same flashcard-style **Show solution** interaction. Submitting or revealing marks a question completed, while the reversible **Needs review** control is independent of correctness.

## Local development

Use Node 22 (see `.nvmrc`) and npm:

```bash
nvm use
npm ci
npm run dev
```

Vite prints the development URL, normally `http://localhost:5173/interview-review/`. The repository-prefix path is intentional and matches GitHub Pages.

Run all local checks:

```bash
npm run typecheck
npm run validate:bank
npm test
npm run build
npm run test:e2e
```

Inspect the production build with:

```bash
npm run build
npm run preview
```

Then open `http://localhost:4173/interview-review/`. Playwright starts its own preview server, tests Chromium at desktop and 375px-class mobile size, and expects Chromium installed (`npx playwright install chromium` if needed).

## Question bank

The runtime bank is `public/questions.json`. Replace that file with a complete bank conforming to schema version `1.0.0`, then run `npm run validate:bank`. The validator rejects the entire malformed bank and the app shows a retryable error; it does not silently omit questions. Keep learner data out of this file. Progress is keyed by question ID and version, so increment a question's version when its learning content changes.

The original supplied `questions.json` remains at the repository root for provenance. At implementation time it was copied byte-for-byte to `public/questions.json`.

## Base path

The default production base is `/interview-review/`, matching the `selma0817/interview-review` repository. For a renamed repository, build with the new leading/trailing-slash path:

```bash
VITE_BASE_PATH=/new-repository-name/ npm run build
```

For a custom domain or root deployment use `VITE_BASE_PATH=/`. Assets and the bank request both use Vite's configured base.

## GitHub Pages deployment

Live site: https://selma0817.github.io/interview-review/ (repository `selma0817/interview-review`).

Nothing is published automatically by this repository. After local review:

1. Create the intended GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Open **Actions → Deploy → Run workflow**, select `main`, and run it.
4. Wait for verification and deployment, then open the URL shown by the `github-pages` environment/workflow output.

The CI workflow runs on pull requests and pushes to `main`. Deployment is separately manual, restricted to `main`, and uses GitHub's Pages/OIDC permissions—no PAT or API key. To opt into push-to-main deployment later, add `push: branches: [main]` under the deploy workflow's `on` block after review.

## Browser data and limitations

Progress uses only `cs-review:progress:v1` in localStorage. Reset removes only that key. Completion means a multiple-choice answer was submitted or a solution was revealed; it is not a mastery score. Incorrect history and the manually controlled review queue are stored separately. Data does not sync between browsers/devices; there is no export/import, multi-tab merge, scheduling algorithm, automatic free-text grading, or secure exam mode. Answers in a static deployment are public assets.
