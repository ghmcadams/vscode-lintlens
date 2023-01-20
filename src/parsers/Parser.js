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
                return {};
            }

            eslintConfig.forEach(section => {
                const {
                    rules: {
                        entries: rules
                    } = {}
                } = section;

                flagDuplicates(rules);
            });

            return eslintConfig;
        } catch(err) {
            return {};
        }
    }

    getRules() {
        try {
            const eslintConfig = this.parse();
            if (eslintConfig === null) {
                return [];
            }

            return eslintConfig.flatMap(section => {
                const {
                    rules: {
                        entries: rules
                    } = {}
                } = section;

                flagDuplicates(rules);

                return rules;
            });
        } catch(err) {
            return [];
        }
    }

    getRulesContainers() {
        try {
            const eslintConfig = this.parse({ containersOnly: true });
            if (eslintConfig === null) {
                return [];
            }

            return eslintConfig.flatMap(section => {
                const {
                    rules: {
                        containers
                    } = {}
                } = section;

                return containers;
            });
        } catch(err) {
            return [];
        }
    }
}

function flagDuplicates(rules) {
    let ruleNames = rules.map(rule => rule.name);

    rules.forEach((rule, index) => {
        let otherIndex = ruleNames.indexOf(rule.name, index + 1);
        if (otherIndex > -1) {
            // TODO: ?? add something to the object that points to the other rule ??
            rule.duplicate = true;
            rules[otherIndex].duplicate = true;
        }
    });
}


/*
FUTURE of parsers:

parse(options) should not be run externally

    options:
        containersOnly: bool



    [ // all config sections - for legacy, main and each overrides
        {
            plugins: {
                containers: Range[],
                entries: [
                    {
                        key: string   // used in ruleIds
                        value: string // used in finding the plugin itself (will equal key on legacy configs)
                    }
                ]
            },
            rules: {
                containers: Range[],
                entries: [
                    {
                        name,
                        keyRange,
                        severityRange,
                        optionsRange,
                        optionsConfig,
                        lineEndingRange
                    }
                ]
            }
        }
    ]
*/
