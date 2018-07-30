module.exports = function flagDuplicates(rules) {
    let ruleNames = rules.map(rule => rule.name);

    return rules.map((rule, index) => {
        let otherIndex = ruleNames.indexOf(rule.name, index + 1);
        if (otherIndex > -1) {
            rule.duplicate = true;
            rules[otherIndex].duplicate = true;
        }

        return rule;
    });
};
