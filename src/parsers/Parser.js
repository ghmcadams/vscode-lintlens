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
                .flatMap(container => container.entries);

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
                entries: [
                    {
                        name,
                        range,
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
                ]
            }
        ]
    }
]

*/
