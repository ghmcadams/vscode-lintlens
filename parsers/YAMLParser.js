const vscode = require('vscode');
const yaml = require('yaml-ast-parser');
const Parser = require('./Parser');

module.exports = class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const ast = yaml.load(this.document.getText());

        const mainRules = this.getRulesFromNode(ast);

        const overrideRules = ast.mappings
            .filter(prop => prop.key.value === 'overrides')
            .flatMap(prop => prop.value.items.flatMap(item => this.getRulesFromNode(item)));

        return mainRules.concat(overrideRules);
    }

    getRulesFromNode(node) {
        return node.mappings
            .filter(prop => prop.key.value === 'rules')
            .flatMap(prop => prop.value.mappings.map(rule => this.getRule(rule)));
    }

    getRule(rule) {
        let keyStartPosition = this.document.positionAt(rule.startPosition - 1);
        let keyEndPosition = this.document.positionAt(rule.endPosition - 1);
        let keyRange = this.document.validateRange(
            new vscode.Range(keyStartPosition, keyEndPosition),
        );
        let lineEndingRange = this.document.validateRange(
            new vscode.Range(
                keyStartPosition.line,
                Number.MAX_SAFE_INTEGER,
                keyStartPosition.line,
                Number.MAX_SAFE_INTEGER,
            ),
        );

        return {
            name: rule.key.value,
            keyRange,
            lineEndingRange,
        };
    }
};
