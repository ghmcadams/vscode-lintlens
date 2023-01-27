export default class Parser {
    constructor(document) {
        if (new.target === Parser) {
            throw new Error('Parser cannot be instantiated directly.');
        }

        this.document = document;
    }

    parse() {
        throw new Error('parse() not implemented.');
    }

    getConfig() {
        try {
            const eslintConfig = this.parse();
            if (eslintConfig === null) {
                return [];
            }

            augmentConfig(eslintConfig);

            return eslintConfig;
        } catch(err) {
            return [];
        }
    }

    getRules() {
        try {
            const eslintConfig = this.getConfig();

            const rules = eslintConfig
                .flatMap(section => section.rules)
                .flatMap(container => container.entries)
                .filter(entry => entry.type === EntryType.Rule);

            return mergeDuplicateRuleEntries(rules);
        } catch(err) {
            return [];
        }
    }

    getActiveRange(position) {
        throw new Error('getRange() not implemented.');
    }
}

function augmentConfig(eslintConfig) {
    eslintConfig.forEach(section => {
        const allRules = section.rules.flatMap(container => container.entries);
        flagDuplicateRuleConfigurations(allRules);
    });
}

function mergeDuplicateRuleEntries(rules) {
    const mergedRules = {};

    rules.forEach(rule => {
        const key = `${rule.range.start.line}-${rule.range.start.character}-${rule.range.end.line}-${rule.range.end.character}`;
        mergedRules[key] = {
            ...(mergedRules[key] ?? {}),
            ...rule,
            duplicateEntries: [
                ...(mergedRules[key] ?? {}).duplicateEntries ?? [],
                ...rule.duplicateEntries ?? []
            ]
        };
    });

    return Object.values(mergedRules);
}

function flagDuplicateRuleConfigurations(rules) {
    rules.forEach(rule => {
        // only if we haven't seen this rule before
        if (!rule.duplicate) {
            // this includes the original
            const duplicates = rules.filter(otherRule => otherRule.name === rule.name);

            if (duplicates.length > 1) {
                duplicates.forEach(duplicateRule => {
                    duplicateRule.duplicate = true;
                    duplicateRule.duplicateEntries = duplicates.filter(dup => !dup.range.isEqual(duplicateRule.range));
                });
            }
        }
    });
}

export const EntryType = {
    Comment: 'Comment',

    PluginsContainer: 'PluginsContainer',
    RulesContainer: 'RulesContainer',

    Pointer: 'Pointer',

    Plugin: 'Plugin',
    PluginKey: 'PluginKey',
    PluginValue: 'PluginValue',
    EmptyPluginKey: 'EmptyPluginKey',
    EmptyPluginValue: 'EmptyPluginValue',

    Rule: 'Rule',
    RuleKey: 'RuleKey',
    RuleValue: 'RuleValue',
    EmptyRuleKey: 'EmptyRuleKey',
    EmptyRuleValue: 'EmptyRuleValue',

    Other: 'Other'
};

/*
[ // array of sections (configs)
    {
        plugins: [ // array of containers
            {
                range,
                entries: PluginsEntry[]
            }
        ],
        rules: [ // array of containers
            {
                range,
                entries: RulesEntry[]
            }
        ]
    }
]

PluginsEntry: {
    type: PluginsEntryType
    range
} & (Plugin | Pointer | EmptyPlugin)

RulesEntry: {
    type: RulesEntryType
    range
} & (Rule | Pointer | EmptyRuleKey)

PluginsEntryType: ENUM (Plugin, Pointer, EmptyPlugin, ...)
RulesEntryType: ENUM (Rule, Pointer, EmptyRule, ...)

Plugin: {
    name,
    key,
    value
}

Rule: {
    name,
    key: {
        range
    },
    configuration: {
        range,
        severityRange,
        optionsRange,
        value
    }
}

Pointer: {
    name
}


TODO: these things

rule severity - should I include a `type` property? (pointer, literal)
- this might enable me to know variables used...

do I need line ending range? (can calculate that in the controller)
*/
