const vscode = require('vscode');
const acorn = require('acorn');
const flagDuplicates = require('./flagDuplicates');

module.exports = function getRules(document) {
    let rules = [];
    let ast = acorn.parse(document.getText(), { locations: true, sourceType: 'module' });

    ast.body.forEach(stmt => {
        if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression') {
            if (stmt.expression.left.type === 'MemberExpression') {
                if (stmt.expression.left.object.name === 'module' && stmt.expression.left.property.name === 'exports') {
                    stmt.expression.right.properties.forEach(prop => {
                        if ((prop.key.type === 'Literal' && prop.key.value === 'rules') || (prop.key.type === 'Identifier' && prop.key.name === 'rules')) {
                            prop.value.properties.forEach(rule => {
                                let keyStartPosition = new vscode.Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                                let keyEndPosition = new vscode.Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                                let keyRange = document.validateRange(new vscode.Range(keyStartPosition, keyEndPosition));
                                let lineEndingRange = document.validateRange(new vscode.Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                                let name;
                                if (rule.key.type === 'Literal') {
                                    name = rule.key.value;
                                } else if (rule.key.type === 'Identifier') {
                                    name = rule.key.name;
                                } else {
                                    return;
                                }

                                rules.push({
                                    name,
                                    keyRange,
                                    lineEndingRange
                                });
                            });
                        }
                    });
                }
            }
        }
    });

    return flagDuplicates(rules);
};
