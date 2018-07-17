const acorn = require('acorn');
const ESLintRuleCodeLensProvider = require('./eslintRuleCodeLensProvider');

module.exports = class JSONCodeLensProvider extends ESLintRuleCodeLensProvider {
    getRules(document) {
        let rules = [];
        let ast = acorn.parseExpressionAt(document.getText(), 0, { locations: true });

        ast.properties.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.properties.forEach(rule => {
                    rules.push({
                        name: rule.key.value,
                        start: document.positionAt(rule.start - 1),
                        end: document.positionAt(rule.end - 1)
                    });
                });
            }
        });

        return rules;
    }
}
