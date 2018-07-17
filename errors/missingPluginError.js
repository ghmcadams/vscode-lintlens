const RuleError = require('./ruleError');

module.exports = class MissingPluginError extends RuleError {
    constructor(plugin, ...rest) {
        super(...rest);
        this.plugin = plugin;
    }
}
