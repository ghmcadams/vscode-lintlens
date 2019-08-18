const acorn = require('acorn');
const AcornParser = require('./AcornParser');

module.exports = class JSParser extends AcornParser {
    constructor(document) {
        super(document);
    }

    get ast() {
        return acorn.parse(this.document.getText(), { locations: true, sourceType: 'module' });
    }

    get rules() {
        return this.ast.body
            .filter(isModuleExports)
            .flatMap(statement => this.getAllRules(statement.expression.right));
    }

    getNodeKey(node) {
        return node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal'
            ? node.key.value
            : undefined;
    }
};

function isModuleExports(statement) {
    return (
        statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'AssignmentExpression' &&
        statement.expression.left.type === 'MemberExpression' &&
        statement.expression.left.object.name === 'module' &&
        statement.expression.left.property.name === 'exports'
    );
}
