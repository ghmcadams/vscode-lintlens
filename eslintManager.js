const path = require('path');
const vscode = require('vscode');
const eslint = require('eslint');
const Fuse = require('fuse.js');
const MissingPluginError = require('./errors/missingPluginError');
const constants = require('./constants');

const linter = new eslint.Linter();
let rules = linter.rules.getAllLoadedRules();
let ruleKeys = {};
const pluginsImported = [];

const fuseOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 10,
    maxPatternLength: 50,
    minMatchCharLength: 1
};

loadAllRules();

function breakOutRuleName(ruleName) {
    let plugin = null;
    let key = ruleName;
    let ruleNameParts = ruleName.split('/');
    if (ruleNameParts.length > 1) {
        plugin = ruleNameParts[0];
        key = ruleNameParts[1];
    }

    return {
        plugin,
        key
    };
}

function loadAllRules() {
    rules = linter.rules.getAllLoadedRules();
    ruleKeys = Array.from(rules.keys())
        .reduce((ret, item) => {
            let ruleParts = breakOutRuleName(item);
            let plugin = ruleParts.plugin || 'base';

            ret[plugin] = ret[plugin] || [];
            ret[plugin].push(ruleParts.key);

            return ret;
        }, {});

}

function searchRules({plugin, key}) {
    const list = ruleKeys[plugin || 'base'];
    const fuse = new Fuse(list, fuseOptions);
    let suggestedRules = fuse.search(key);

    return suggestedRules.map(index => {
        return ((plugin ? plugin + '/' : '') + list[index]);
    });
}

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

            loadAllRules();

            return pluginName;
        }, err => {
            throw err;
        });
}

function getRuleDetails(ruleName) {
    // If the rule is a plugin rule, import plugin first
    let ruleParts = breakOutRuleName(ruleName);

    const pluginPackageName = `${constants.eslintPluginPrefix}${ruleParts.plugin}`;
    const pluginUrl = `${constants.npmPackageBaseUrl}${pluginPackageName}`;

    return importPlugin(ruleParts.plugin)
        .then((pluginName) => {
            if (!rules.has(ruleName)) {
                return {
                    ruleName,
                    pluginName,
                    isRuleFound: false,
                    suggestedRules: searchRules(ruleParts),
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
                    pluginName: ruleParts.plugin,
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
