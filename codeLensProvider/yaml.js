const yaml = require('yaml-ast-parser');
const ESLintRuleCodeLensProvider = require('./eslintRuleCodeLensProvider');

module.exports = class YAMLCodeLensProvider extends ESLintRuleCodeLensProvider {
    getRules(document) {
        let rules = [];
        let ast = yaml.load(document.getText());

        ast.mappings.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.mappings.forEach(rule => {
                    rules.push({
                        name: rule.key.value,
                        start: document.positionAt(rule.startPosition - 1),
                        end: document.positionAt(rule.endPosition - 1)
                    });
                });
            }
        });

        return rules;
    }
}
