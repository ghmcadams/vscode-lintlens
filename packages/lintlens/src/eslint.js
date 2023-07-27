import { MissingESLintError, UnsupportedESLintError } from './errors';
import { getPackageForDocument } from './packages';


const rulesCache = new Map();

export function getLinterRules(documentFilePath) {
    let eslint;
    try {
        eslint = getPackageForDocument('eslint', documentFilePath);
    } catch (err) {
        // console.log(`Error importing eslint: `, err.message || err);
        throw new MissingESLintError();
    }

    const linter = new eslint.Linter();
    if (!linter.getRules || typeof linter.getRules !== "function") {
        throw new UnsupportedESLintError();
    }

    if (rulesCache.has(linter.version)) {
        return rulesCache.get(linter.version);
    }

    const builtinRules = linter.getRules();

    const output = {
        map: builtinRules,
        keys: {
            base: Array.from(builtinRules.keys())
        },
        pluginsImported: []
    };

    rulesCache.set(linter.version, output);

    return rulesCache.get(linter.version);
}
