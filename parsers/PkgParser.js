const vscode = require('vscode');
const acorn = require('acorn');
const Parser = require('./Parser');

module.exports = class PkgParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let ast = acorn.parseExpressionAt(this.document.getText(), 0, { locations: true });

        return ast.properties
            .filter(prop => prop.key.value === 'eslintConfig')
            .flatMap(prop => {
                const mainRules = this.getRulesFromNode(prop.value);

                const overrideRules = prop.value.properties
                    .filter(prop => prop.key.value === 'overrides')
                    .flatMap(prop =>
                        prop.value.elements.flatMap(item => this.getRulesFromNode(item)),
                    );

                return mainRules.concat(overrideRules);
            });
    }

    getRulesFromNode(node) {
        return node.properties
            .filter(prop => prop.key.value === 'rules')
            .flatMap(prop => prop.value.properties.map(rule => this.getRule(rule)));
    }

    getRule(rule) {
        let keyStartPosition = new vscode.Position(
            rule.key.loc.start.line - 1,
            rule.key.loc.start.column,
        );
        let keyEndPosition = new vscode.Position(
            rule.key.loc.end.line - 1,
            rule.key.loc.end.column,
        );
        let keyRange = this.document.validateRange(
            new vscode.Range(keyStartPosition, keyEndPosition),
        );
        let lineEndingRange = this.document.validateRange(
            new vscode.Range(
                rule.key.loc.start.line - 1,
                Number.MAX_SAFE_INTEGER,
                rule.key.loc.start.line - 1,
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
