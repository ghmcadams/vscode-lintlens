import { MissingESLintError, UnsupportedESLintError } from './errors';
import { getPackageForDocument } from './packages';


const rulesCache = new Map();

function getESLintVersion(documentFilePath) {
    try {
        const pkg = getPackageForDocument('eslint/package.json', documentFilePath);
        return pkg.version;
    } catch (err) {
        const eslint = getPackageForDocument('eslint', documentFilePath);
        const linter = new eslint.Linter();
        return linter.version;
    }
}

function getBuiltinRulesMap(eslint, documentFilePath) {
    try {
        const unsupportedApi = getPackageForDocument('eslint/use-at-your-own-risk', documentFilePath);
        if (unsupportedApi?.builtinRules && typeof unsupportedApi.builtinRules.keys === 'function') {
            return new Map(unsupportedApi.builtinRules);
        }
    } catch (err) {
        // fall through to linter.getRules() if eslint/use-at-your-own-risk is not available
    }

    const linter = new eslint.Linter();
    if (linter.getRules && typeof linter.getRules === 'function') {
        return new Map(linter.getRules());
    }

    throw new UnsupportedESLintError();
}

export function getLinterRules(documentFilePath) {
    let eslint;
    try {
        eslint = getPackageForDocument('eslint', documentFilePath);
    } catch (err) {
        throw new MissingESLintError();
    }

    const version = getESLintVersion(documentFilePath);

    if (rulesCache.has(version)) {
        return rulesCache.get(version);
    }

    const builtinRules = getBuiltinRulesMap(eslint, documentFilePath);

    const output = {
        map: builtinRules,
        keys: {
            base: Array.from(builtinRules.keys())
        },
        pluginsImported: []
    };

    rulesCache.set(version, output);

    return output;
}
