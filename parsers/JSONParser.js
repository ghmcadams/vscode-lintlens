const vscode = require('vscode');
const acorn = require('acorn');
const Parser = require('./Parser');

module.exports = class JSONParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let rules = [];
        let ast = acorn.parseExpressionAt(this.document.getText(), 0, { locations: true });

        ast.properties.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.properties.forEach(rule => {
                    let keyStartPosition = new vscode.Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                    let keyEndPosition = new vscode.Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                    let keyRange = this.document.validateRange(new vscode.Range(keyStartPosition, keyEndPosition));
                    let lineEndingRange = this.document.validateRange(new vscode.Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                    rules.push({
                        name: rule.key.value,
                        keyRange,
                        lineEndingRange
                    });
                });
            }
        });

        return rules;
    }
};
