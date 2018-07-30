const vscode = require('vscode');
const acorn = require('acorn');
const flagDuplicates = require('./flagDuplicates');

module.exports = function getRules(document) {
    let rules = [];
    let ast = acorn.parseExpressionAt(document.getText(), 0, { locations: true });

    ast.properties.forEach(prop => {
        if (prop.key.value === 'eslintConfig') {
            prop.value.properties.forEach(cfg => {
                if (cfg.key.value === 'rules') {
                    cfg.value.properties.forEach(rule => {
                        let keyStartPosition = new vscode.Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                        let keyEndPosition = new vscode.Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                        let keyRange = document.validateRange(new vscode.Range(keyStartPosition, keyEndPosition));
                        let lineEndingRange = document.validateRange(new vscode.Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                        rules.push({
                            name: rule.key.value,
                            keyRange,
                            lineEndingRange
                        });
                    });
                }
            });
        }
    });

    return flagDuplicates(rules);
};
