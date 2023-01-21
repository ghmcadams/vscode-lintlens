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

            // TODO: flag duplicates, etc.
            // eslintConfig.forEach(section => {
            //     const {
            //         rules: {
            //             entries: rules
            //         } = {}
            //     } = section;

            //     flagDuplicates(rules);
            // });

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

            // TODO: flag duplicates, etc.

            return eslintConfig
                .flatMap(section => section.rules)
                .flatMap(container => container.entries);
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
                        range,
                        key: {
                            name,
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
