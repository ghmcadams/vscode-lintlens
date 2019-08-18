const vscode = require('vscode');
const acorn = require('acorn');
const Parser = require('./Parser');

module.exports = class AcornParser extends Parser {
    constructor(document) {
        if (new.target === AcornParser) {
            throw new Error('AcornParser cannot be instantiated directly.');
        }

        super(document);
    }

    get ast() {
        // This default implementation fits for JSON and Package parsers.
        // JS parser overrides it.
        return acorn.parseExpressionAt(this.document.getText(), 0, { locations: true });
    }

    getProps(node) {
        return node.properties;
    }

    getItems(node) {
        return node.elements;
    }

    getRuleLocation(rule) {
        const [start, end] = [rule.key.loc.start, rule.key.loc.end];

        return [
            new vscode.Position(start.line - 1, start.column),
            new vscode.Position(end.line - 1, end.column),
        ];
    }
};
