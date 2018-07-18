const LintLensError = require('./lintlensError');

module.exports = class MissingPluginError extends LintLensError {
    constructor(plugin, ...rest) {
        super(...rest);
        this.plugin = plugin;
    }
}
