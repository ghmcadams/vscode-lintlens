module.exports = class Parser {
    constructor(document) {
        if (new.target === Parser) {
            throw new Error('Parser cannot be instantiated directly.');
        }

        this.document = document;
    }

    parse() {
        return [];
    }

    getRules() {
        let rules = this.parse();

        if (!rules || rules.length === 0) {
            return rules;
        }

        return this.flagDuplicates(rules);
    }

    flagDuplicates(rules) {
        let ruleNames = rules.map(rule => rule.name);

        return rules.map((rule, index) => {
            let otherIndex = ruleNames.indexOf(rule.name, index + 1);
            if (otherIndex > -1) {
                rule.duplicate = true;
                rules[otherIndex].duplicate = true;
            }

            return rule;
        });
    }
}
