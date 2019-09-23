import Fuse from 'fuse.js';
import { MissingPluginError, MissingESLintError, UnsupportedESLintError } from './errors';
import { npmPackageBaseUrl, eslintRulesUrl, MISSING_URL_URL, eslintPluginPrefix } from './constants';
import { getWorkspaceDir } from './workspace';

const rules = loadRules();
const pluginsImported = [];

const fuseOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 10,
    maxPatternLength: 50,
    minMatchCharLength: 1
};

function loadRules() {
    const eslintPackagePath = getWorkspaceDir('./node_modules/eslint');

    if (!eslintPackagePath) {
        throw new MissingESLintError();
    }

    const eslint = __non_webpack_require__(eslintPackagePath);
    const linter = new eslint.Linter();

    if (!linter.getRules || typeof linter.getRules !== "function") {
        throw new UnsupportedESLintError();
    }

    const builtinRules = linter.getRules();
    return {
        map: builtinRules,
        keys: {
            base: Array.from(builtinRules.keys())
        }
    };
}

function importPlugin(pluginName, pluginPackageName) {
    const pluginPackagePath = getWorkspaceDir(`./node_modules/${pluginPackageName}`);

    if (!pluginPackagePath) {
        throw new MissingPluginError(pluginName);
    }

    let plugin;
    try {
        plugin = __non_webpack_require__(pluginPackagePath);
    } catch(err) {
        console.log(`Error importing ${pluginName}: `, err.message || err);
    }

    if (plugin.rules) {
        const keys = Object.keys(plugin.rules);
        keys.forEach(ruleId => {
            const qualifiedRuleId = `${pluginName}/${ruleId}`;
            const rule = plugin.rules[ruleId];

            rules.map.set(qualifiedRuleId, rule);
        });

        rules.keys[pluginName] = keys;
    }

    pluginsImported.push(pluginName);
}

function breakOutRuleName(ruleName) {
    let ruleNameParts = ruleName.split('/');

    let scope;
    if (ruleNameParts[0].startsWith('@')) {
        [scope, ...ruleNameParts] = ruleNameParts;
    }

    let plugin;
    if (ruleNameParts.length > 1) {
        [plugin, ...ruleNameParts] = ruleNameParts;
    }

    const ruleId = ruleNameParts.join('/');

    let pluginName;
    if (scope || plugin) {
        if (scope && plugin) {
            pluginName = `${scope}/${plugin}`;
        }

        pluginName = scope || plugin;
    }

    return {
        pluginName,
        ruleId
    };
}

function searchRules(pluginName, ruleId) {
    const list = rules.keys[pluginName || 'base'] || [];
    const fuse = new Fuse(list, fuseOptions);
    let suggestedRules = fuse.search(ruleId);

    return suggestedRules.map(index => {
        return ((pluginName ? pluginName + '/' : '') + list[index]);
    });
}

export function getRuleDetails(ruleName) {
    const { pluginName, ruleId } = breakOutRuleName(ruleName);

    const pluginPackageName = getPluginPackageName(pluginName);
    const pluginUrl = `${npmPackageBaseUrl}${pluginPackageName}`;

    if (pluginName && !pluginsImported.includes(pluginName)) {
        try {
            importPlugin(pluginName, pluginPackageName);
        } catch (err) {
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

            //TODO: how should I handle other errors from importPlugin()?
        }
    }

    if (!rules.map.has(ruleName)) {
        return {
            ruleName,
            pluginName,
            isRuleFound: false,
            suggestedRules: searchRules(pluginName, ruleId),
            isPluginMissing: false,
            infoUrl: pluginName ? pluginUrl : eslintRulesUrl,
            infoPageTitle: pluginName ? pluginPackageName : 'eslint rules'
        };
    }

    const {
        meta: ruleMeta = {},
        meta: {
            docs: ruleDocs = {}
        } = {}
    } = rules.map.get(ruleName);

    return {
        ruleName,
        pluginName,
        isRuleFound: true,
        isPluginMissing: false,
        infoUrl: ruleDocs.url || (pluginName ? MISSING_URL_URL : eslintRulesUrl),
        infoPageTitle: ruleName,
        category: ruleDocs.category,
        isRecommended: ruleDocs.recommended,
        isFixable: ruleMeta.fixable ? true : false,
        isDeprecated: ruleMeta.deprecated ? true : false,
        replacedBy: ruleDocs.replacedBy,
        description: ruleDocs.description
    };
}

function getPluginPackageName(pluginName) {
    if (!pluginName) {
        return '';
    }

    if (pluginName.includes('/')) {
        const [scope, plugin] = pluginName.split('/');
        return `${scope}/${eslintPluginPrefix}-${plugin}`;
    }

    if (pluginName.startsWith('@')) {
        return `${pluginName}/${eslintPluginPrefix}`;
    }

    return `${eslintPluginPrefix}-${pluginName}`;
}
