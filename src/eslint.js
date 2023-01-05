import { getPackagePathForDocument } from './workspace';
import { MissingESLintError, UnsupportedESLintError } from './errors';


const rulesCache = new Map();

export function getLinterRules(documentFilePath) {
    const eslintPackagePath = getPackagePathForDocument(documentFilePath, 'eslint');
    if (!eslintPackagePath) {
        throw new MissingESLintError();
    }

    if (rulesCache.has(eslintPackagePath)) {
        return rulesCache.get(eslintPackagePath);
    }

    const eslint = __non_webpack_require__(eslintPackagePath);
    const linter = new eslint.Linter();
    if (!linter.getRules || typeof linter.getRules !== "function") {
        throw new UnsupportedESLintError();
    }

    const builtinRules = linter.getRules();

    const output = {
        map: builtinRules,
        keys: {
            base: Array.from(builtinRules.keys())
        },
        pluginsImported: []
    };

    rulesCache.set(eslintPackagePath, output);

    return rulesCache.get(eslintPackagePath);
}
