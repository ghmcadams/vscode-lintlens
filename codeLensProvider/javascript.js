const acorn = require('acorn');
const ESLintRuleCodeLensProvider = require('./eslintRuleCodeLensProvider');

module.exports = class JSCodeLensProvider extends ESLintRuleCodeLensProvider {
    getRules(document) {
        let rules = [];
        let ast = acorn.parse(document.getText(), { locations: true, sourceType: 'module' });

        ast.body.forEach(stmt => {
            if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression') {
                if (stmt.expression.left.type === 'MemberExpression') {
                    if (stmt.expression.left.object.name === 'module' && stmt.expression.left.property.name === 'exports') {
                        stmt.expression.right.properties.forEach(prop => {
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
                    }
                }
            }
        });

        return rules;
    }
}
