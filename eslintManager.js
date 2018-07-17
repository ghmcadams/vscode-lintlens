const path = require('path');
const vscode = require('vscode');
const MissingPluginError = require('./errors/missingPluginError');

const npmPackageBaseUrl = 'https://www.npmjs.com/package/';
const eslintPluginPrefix = 'eslint-plugin-';
const eslintRulesUrl = 'https://eslint.org/docs/rules/';

let eslintPath;
let linter;
let rulesList;
const pluginsImported = [];

getESLint().then(eslint => {
    if (eslint) {
        linter = new eslint.Linter();
        rulesList = linter.rules.getAllLoadedRules();
    }
});

function getESLint() {
    if (eslintPath) {
        return Promise.resolve(require(eslintPath));
    }

    return vscode.workspace.findFiles('**/node_modules/eslint/package.json', null, 1)
        .then(packagePaths => {
            if (packagePaths.length === 0) {
                try {
                    eslintPath = 'eslint';
                    return require('eslint');
                } catch(e) {
                    return null;
                }
            } else {
                let dirname = path.dirname(packagePaths[0].path);
                eslintPath = dirname;
                return require(dirname);
            }
        }, err => {
        });
}

function isPluginImported(pluginName) {
    return (pluginsImported.indexOf(pluginName) > -1);
}

function importPlugin(pluginName) {
    if (isPluginImported(pluginName)) {
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
                rulesList = linter.rules.getAllLoadedRules();
            }
        });
}

function hasRule(ruleName) {
    return rulesList.has(ruleName);
}

function getRuleData(ruleName) {
    let foundRule = rulesList.get(ruleName);
    return (foundRule && foundRule.meta && foundRule.meta.docs) ? foundRule.meta.docs : {};
}

module.exports = {
    getESLint,
    isPluginImported,
    importPlugin,
    hasRule,
    getRuleData,
    eslintPluginPrefix,
    npmPackageBaseUrl,
    eslintRulesUrl
};
