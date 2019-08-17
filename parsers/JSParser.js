const vscode = require('vscode');
const acorn = require('acorn');
const Parser = require('./Parser');

function getPropValue(prop) {
    switch (prop.key.type) {
        case 'Literal':
            return prop.key.value;
        case 'Identifier':
            return prop.key.name;
    }
}

module.exports = class JSParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let ast = acorn.parse(this.document.getText(), { locations: true, sourceType: 'module' });

        return ast.body
            .filter(
                stmt =>
                    stmt.type === 'ExpressionStatement' &&
                    stmt.expression.type === 'AssignmentExpression' &&
                    stmt.expression.left.type === 'MemberExpression' &&
                    stmt.expression.left.object.name === 'module' &&
                    stmt.expression.left.property.name === 'exports',
            )
            .flatMap(stmt => {
                const mainRules = this.getRulesFromNode(stmt.expression.right);

                const overrideRules = stmt.expression.right.properties
                    .filter(prop => getPropValue(prop) === 'overrides')
                    .flatMap(prop =>
                        prop.value.elements.flatMap(item => this.getRulesFromNode(item)),
                    );

                return mainRules.concat(overrideRules);
            });
    }

    getRulesFromNode(node) {
        return node.properties
            .filter(prop => getPropValue(prop) === 'rules')
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

        let name = getPropValue(rule);
        if (!name) {
            return;
        }

        return {
            name,
            keyRange,
            lineEndingRange,
        };
    }
};
