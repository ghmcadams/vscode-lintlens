# LintLens ESLint fixtures

Sample workspaces for verifying ESLint version compatibility.

## Setup

From the repo root:

```bash
npm install
```

Or install dependencies in each fixture individually:

```bash
npm install --prefix packages/lintlens/fixtures/eslint10-flat-js
npm install --prefix packages/lintlens/fixtures/eslint10-flat-ts
npm install --prefix packages/lintlens/fixtures/eslint9-legacy
npm install --prefix packages/lintlens/fixtures/eslint8-legacy
npm install --prefix packages/lintlens/fixtures/eslint7-legacy
```

```bash
npm run verify:eslint --workspace=lintlens
```
