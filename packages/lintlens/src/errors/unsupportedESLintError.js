import LintLensError from './lintlensError';

export default class UnsupportedESLintError extends LintLensError {
    constructor(...rest) {
      super(...rest);
      this.name = "UnsupportedESLintError";
      this.message = "Please update to latest version of ESLint to use this extension!"
  }
}
