const vscode = require('vscode');
const yaml = require('yaml-ast-parser');
const Parser = require('./Parser');

module.exports = class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let rules = [];
        let ast = yaml.load(this.document.getText());

        ast.mappings.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.mappings.forEach(rule => {
                    let keyStartPosition = this.document.positionAt(rule.startPosition - 1);
                    let keyEndPosition = this.document.positionAt(rule.endPosition - 1);
                    let keyRange = this.document.validateRange(new vscode.Range(keyStartPosition, keyEndPosition));
                    let lineEndingRange = this.document.validateRange(new vscode.Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));
    
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
