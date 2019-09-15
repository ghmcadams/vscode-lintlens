import LintLensError from './lintlensError';

export default class MissingPluginError extends LintLensError {
    constructor(plugin, ...rest) {
        super(...rest);
        this.plugin = plugin;
    }
}
