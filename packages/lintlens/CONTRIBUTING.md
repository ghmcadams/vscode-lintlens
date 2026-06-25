# Contributing to LintLens

## Development

```bash
npm install
npm run build --workspace=lintlens
```

Press F5 in VS Code with the extension development host to debug.

## Verifying ESLint compatibility

LintLens loads ESLint from each workspace's `node_modules`. Use the fixtures under `fixtures/` to test against specific ESLint versions.

```bash
npm install --prefix packages/lintlens/fixtures/eslint10-flat-js
npm install --prefix packages/lintlens/fixtures/eslint10-flat-ts
npm install --prefix packages/lintlens/fixtures/eslint9-legacy
npm install --prefix packages/lintlens/fixtures/eslint8-legacy
npm install --prefix packages/lintlens/fixtures/eslint7-legacy
npm run verify:eslint --workspace=lintlens
```

See [fixtures/README.md](./fixtures/README.md)
