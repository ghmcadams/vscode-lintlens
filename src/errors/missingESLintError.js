import LintLensError from './lintlensError';

export default class MissingESLintError extends LintLensError {
    constructor(...rest) {
      super(...rest);
      this.name = "MissingESLintError";
      this.message = "Unable to find ESLint within the open folders' node_modules, make sure you've run `npm install` or `yarn`"
  }
}
