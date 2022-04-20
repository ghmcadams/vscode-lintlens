import { getWorkspaceDir } from './workspace';
import { MissingESLintError, UnsupportedESLintError } from './errors';


const eslintPackagePath =
    getWorkspaceDir('./node_modules/eslint') ||
    getWorkspaceDir('.yarn/sdks/eslint');

if (!eslintPackagePath) {
    throw new MissingESLintError();
}

const eslint = __non_webpack_require__(eslintPackagePath);
let linter;

export function getLinter() {
    if (!linter) {
        linter = new eslint.Linter();
        if (!linter.getRules || typeof linter.getRules !== "function") {
            throw new UnsupportedESLintError();
        }
    }
    return linter;
}
