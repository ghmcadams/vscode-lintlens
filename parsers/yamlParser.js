const vscode = require('vscode');
const yaml = require('yaml-ast-parser');
const flagDuplicates = require('./flagDuplicates');

module.exports = function getRules(document) {
    let rules = [];
    let ast = yaml.load(document.getText());

    ast.mappings.forEach(prop => {
        if (prop.key.value === 'rules') {
            prop.value.mappings.forEach(rule => {
                let keyStartPosition = document.positionAt(rule.startPosition - 1);
                let keyEndPosition = document.positionAt(rule.endPosition - 1);
                let keyRange = document.validateRange(new vscode.Range(keyStartPosition, keyEndPosition));
                let lineEndingRange = document.validateRange(new vscode.Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));

                rules.push({
                    name: rule.key.value,
                    keyRange,
                    lineEndingRange
                });
            });
        }
    });

    return flagDuplicates(rules);
};
