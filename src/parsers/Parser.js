export default class Parser {
    constructor(document) {
        if (new.target === Parser) {
            throw new Error('Parser cannot be instantiated directly.');
        }

        this.document = document;
    }

    parse() {
        throw new Error('parse() must be overridden.');
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
    Rule: 'Rule',
    EmptyRule: 'EmptyRule',
    Pointer: 'Pointer',
};

/*
[ // array of sections (configs)
    {
        plugins: [ // array of containers
            {
                range,
                entries: [
                    {
                        key,
                        value
                    }
                ]
            }
        ],
        rules: [ // array of containers
            {
                range,
                entries: Entry[]
            }
        ]
    }
]

Entry: {
    type: EntryType
    range
} & (Rule | Pointer | EmptyRule)

EntryType: ENUM (Rule, Pointer, EmptyRule)

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
    lineEndingRange
}

Pointer: {
    name
}

EmptyRule: {

}


TODO: these things

rule severity - could it have type? (pointer, literal)
- this might enable me to know variables used...

do I need line ending range? (can calculate that in the controller)
*/
