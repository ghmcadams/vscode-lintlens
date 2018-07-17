module.exports = class RuleError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}
