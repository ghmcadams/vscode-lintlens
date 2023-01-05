import Fuse from 'fuse.js';
import { MissingPluginError } from './errors';
import { npmPackageBaseUrl, eslintRulesUrl, MISSING_URL_URL, eslintPluginPrefix } from './constants';
import { getLinterRules } from './eslint';
import { getSchemaDocumentation } from './schema';
import { getPackagePathForDocument } from './workspace';


const fuseOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 10,
    maxPatternLength: 50,
    minMatchCharLength: 1
};

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
        } else {
            pluginName = scope || plugin;
        }
    }

    return {
        pluginName,
        ruleId
    };
}

function importPlugin(documentFilePath, rules, pluginName, pluginPackageName) {
    const pluginPackagePath = getPackagePathForDocument(documentFilePath, pluginPackageName);

    if (!pluginPackagePath) {
        throw new MissingPluginError(pluginName);
    }

    let plugin;
    try {
        plugin = __non_webpack_require__(pluginPackagePath);
    } catch(err) {
        // console.log(`Error importing ${pluginName}: `, err.message || err);
        throw new MissingPluginError(`Error importing ${pluginName}: ${err.message || err}`);
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

    rules.pluginsImported.push(pluginName);
}

function searchRules(rules, pluginName, ruleId) {
    const list = rules.keys[pluginName || 'base'] || [];
    const fuse = new Fuse(list, fuseOptions);
    let suggestedRules = fuse.search(ruleId);

    return suggestedRules.map(index => {
        return ((pluginName ? pluginName + '/' : '') + list[index]);
    });
}

export function getRuleDetails(documentFilePath, ruleName) {
    const rules = getLinterRules(documentFilePath);

    const { pluginName, ruleId } = breakOutRuleName(ruleName);

    const pluginPackageName = getPluginPackageName(pluginName);
    const pluginUrl = `${npmPackageBaseUrl}${pluginPackageName}`;

    if (pluginName && !rules.pluginsImported.includes(pluginName)) {
        try {
            importPlugin(documentFilePath, rules, pluginName, pluginPackageName);
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
            suggestedRules: searchRules(rules, pluginName, ruleId),
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

    let schemaDocumentation = getSchemaDocumentation(ruleMeta.schema);

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
        description: ruleDocs.description,
        schema: ruleMeta.schema,
        schemaDocumentation
    };
}
