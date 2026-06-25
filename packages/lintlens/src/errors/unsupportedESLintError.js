import LintLensError from './lintlensError';

export default class UnsupportedESLintError extends LintLensError {
    constructor(...rest) {
      super(...rest);
      this.name = "UnsupportedESLintError";
      this.message = "Unable to load ESLint rule definitions from this workspace's ESLint installation."
  }
}
