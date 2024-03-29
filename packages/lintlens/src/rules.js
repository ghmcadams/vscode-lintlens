import Fuse from 'fuse.js';
import { getSchemaDocumentation } from 'jsonschema-docgen';
import { MissingPluginError } from './errors';
import { npmPackageBaseUrl, eslintRulesUrl, MISSING_URL_URL, eslintPluginPrefix } from './constants';
import { getLinterRules } from './eslint';
import { getPackageForDocument } from './packages';


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
    let plugin;
    try {
        plugin = getPackageForDocument(pluginPackageName, documentFilePath);
    } catch (err) {
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
    const suggestedRules = fuse.search(ruleId);

    return suggestedRules.map(index => {
        return ((pluginName ? pluginName + '/' : '') + list[index]);
    });
}

export function getRuleDetails(documentFilePath, ruleName) {
    if (!ruleName || ruleName.length === 0) {
        return null;
    }

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

    // https://github.com/eslint/eslint/blob/3e34418b31664decfb2337de798feafbf985b66c/lib/shared/types.js#L137-L160
    const {
        schema,
        meta: ruleMeta = {},
        meta: {
            docs: ruleDocs = {}
        } = {}
    } = rules.map.get(ruleName);

    const ruleSchema = schema ?? ruleMeta.schema ?? [];

    let ruleSchemaToDocument = ruleSchema;
    if (Array.isArray(ruleSchemaToDocument) && ruleSchemaToDocument.length === 1) {
        ruleSchemaToDocument = ruleSchemaToDocument[0];
    }

    let schemaDocumentation;
    try {
        schemaDocumentation = getSchemaDocumentation(ruleSchemaToDocument);
    } catch(err) {
        schemaDocumentation = '<Unavailable>';
    }

    // TODO: Support using schema.example(s) to insert a value as part of autocomplete

    return {
        ruleName,
        pluginName,
        isRuleFound: true,
        isPluginMissing: false,
        infoUrl: ruleDocs.url || (pluginName ? MISSING_URL_URL : eslintRulesUrl),
        infoPageTitle: ruleName,
        type: ruleMeta.type,
        category: ruleDocs.category,
        isRecommended: ruleDocs.recommended,
        isFixable: ruleMeta.fixable ? true : false,
        isDeprecated: ruleMeta.deprecated ? true : false,
        replacedBy: ruleMeta.replacedBy,
        description: ruleDocs.description,
        schema: ruleSchema,
        schemaDocumentation,
    };
}

export function getAllRuleIds(documentFilePath) {
    const rules = getLinterRules(documentFilePath);
    return Array.from(rules.map.keys());
}
