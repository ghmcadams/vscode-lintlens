import Module from 'module';
import { readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures');

function getBuiltinRulesMap(eslint, configFilePath) {
    const myRequire = Module.createRequire(configFilePath);

    try {
        const { builtinRules } = myRequire('eslint/use-at-your-own-risk');
        if (builtinRules && typeof builtinRules.keys === 'function') {
            return new Map(builtinRules);
        }
    } catch (err) {
        // fall through
    }

    const linter = new eslint.Linter();
    if (linter.getRules && typeof linter.getRules === 'function') {
        return new Map(linter.getRules());
    }

    throw new Error('Unable to load ESLint built-in rules');
}

function getESLintVersion(configFilePath) {
    const myRequire = Module.createRequire(configFilePath);
    return myRequire('eslint/package.json').version;
}

function findConfigFile(fixturePath) {
    const candidates = readdirSync(fixturePath);
    const configFile = candidates.find(name =>
        /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/.test(name) ||
        /^\.eslintrc(\.(js|cjs|json|yaml|yml))?$/.test(name)
    );

    if (!configFile) {
        throw new Error(`No ESLint config file found in ${fixturePath}`);
    }

    return join(fixturePath, configFile);
}

function verifyFixture(fixtureName) {
    const fixturePath = join(fixturesDir, fixtureName);
    const configFilePath = findConfigFile(fixturePath);
    const myRequire = Module.createRequire(configFilePath);
    const eslint = myRequire('eslint');
    const version = getESLintVersion(configFilePath);
    const rules = getBuiltinRulesMap(eslint, configFilePath);

    if (rules.size === 0) {
        throw new Error('Expected at least one built-in rule');
    }

    if (!rules.has('no-console')) {
        throw new Error('Expected built-in rule "no-console" to be present');
    }

    console.log(`✓ ${fixtureName} (ESLint ${version}, ${rules.size} rules)`);
}

const fixtureNames = readdirSync(fixturesDir).filter(name => {
    const fixturePath = join(fixturesDir, name);
    return existsSync(join(fixturePath, 'package.json'));
});

let failed = false;

for (const fixtureName of fixtureNames) {
    try {
        verifyFixture(fixtureName);
    } catch (err) {
        failed = true;
        console.error(`✗ ${fixtureName}: ${err.message}`);
    }
}

if (failed) {
    process.exit(1);
}

console.log(`\nAll ${fixtureNames.length} fixture(s) passed.`);
