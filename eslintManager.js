const path = require('path');
const vscode = require('vscode');
const eslint = require('eslint');
const MissingPluginError = require('./errors/missingPluginError');
const constants = require('./constants');

const linter = new eslint.Linter();
let rules = linter.rules.getAllLoadedRules();
const pluginsImported = [];

function importPlugin(pluginName) {
    if (pluginName === null || pluginsImported.indexOf(pluginName) > -1) {
        return Promise.resolve(pluginName);
    }

    return vscode.workspace.findFiles(`**/node_modules/${constants.eslintPluginPrefix}${pluginName}/package.json`, null, 1)
        .then(packagePaths => {
            if (packagePaths.length === 0) {
                throw new MissingPluginError(pluginName);
            }

            let dirname = path.dirname(packagePaths[0].path);
            let package = require(dirname);

            linter.rules.importPlugin(package, pluginName);
            pluginsImported.push(pluginName);

            //reload rules (including the newly imported rules)
            rules = linter.rules.getAllLoadedRules();

            return pluginName;
        }, err => {
            throw err;
        });
}

function getRuleDetails(ruleName) {
    // If the rule is a plugin rule, import plugin first
    let pluginName = null;
    let ruleNameParts = ruleName.split('/');
    if (ruleNameParts.length > 1) {
        pluginName = ruleNameParts[0];
    }

    const pluginPackageName = `${constants.eslintPluginPrefix}${pluginName}`;
    const pluginUrl = `${constants.npmPackageBaseUrl}${pluginPackageName}`;

    return importPlugin(pluginName)
        .then((pluginName) => {
            if (!rules.has(ruleName)) {
                return {
                    ruleName,
                    pluginName,
                    isRuleFound: false,
                    isPluginMissing: false,
                    infoUrl: pluginName ? pluginUrl : constants.eslintRulesUrl,
                    infoPageTitle: pluginName ? pluginPackageName : 'eslint rules'
                };
            }

            let ruleInfo = rules.get(ruleName);
            let ruleMeta = ruleInfo.meta || {};
            let ruleDocs = ruleMeta.docs || {};

            return {
                ruleName,
                pluginName,
                isRuleFound: true,
                isPluginMissing: false,
                infoUrl: ruleDocs.url || (pluginName ? constants.MISSING_URL_URL : constants.eslintRulesUrl),
                infoPageTitle: ruleName,
                category: ruleDocs.category,
                isRecommended: ruleDocs.recommended,
                isFixable: ruleMeta.fixable ? true : false,
                isDeprecated: ruleMeta.deprecated ? true : false,
                replacedBy: ruleDocs.replacedBy,
                description: ruleDocs.description
            };
        }, err => {
            if (err.name === 'MissingPluginError') {
                return {
                    ruleName,
                    pluginName,
                    isRuleFound: false,
                    isPluginMissing: true,
                    infoUrl: pluginUrl,
                    pluginPackageName,
                    infoPageTitle: pluginPackageName
                };
            }
        });
}

module.exports = {
    getRuleDetails
};
