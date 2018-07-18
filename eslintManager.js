const path = require('path');
const vscode = require('vscode');
const eslint = require('eslint');
const MissingPluginError = require('./errors/missingPluginError');

const npmPackageBaseUrl = 'https://www.npmjs.com/package/';
const eslintPluginPrefix = 'eslint-plugin-';
const eslintRulesUrl = 'https://eslint.org/docs/rules/';

const linter = new eslint.Linter();
let rules = linter.rules.getAllLoadedRules();
const pluginsImported = [];

function importPlugin(pluginName) {
    if (pluginsImported.indexOf(pluginName) > -1) {
        return Promise.resolve();
    }

    return vscode.workspace.findFiles(`**/node_modules/${eslintPluginPrefix}${pluginName}/package.json`, null, 1)
        .then(packagePaths => {
            if (packagePaths.length === 0) {
                throw new MissingPluginError(pluginName);
            } else {
                let dirname = path.dirname(packagePaths[0].path);
                let package = require(dirname);

                linter.rules.importPlugin(package, pluginName);
                pluginsImported.push(pluginName);

                //reload rules (including the newly imported rules)
                rules = linter.rules.getAllLoadedRules();
            }
        });
}

function getRule(ruleName) {
    if (!rules.has(ruleName)) {
        return null;
    }

    return rules.get(ruleName);
}

module.exports = {
    importPlugin,
    getRule,
    eslintPluginPrefix,
    npmPackageBaseUrl,
    eslintRulesUrl
};
