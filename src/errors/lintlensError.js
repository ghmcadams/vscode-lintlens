export default class LintLensError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}
