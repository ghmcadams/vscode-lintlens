import { Position, Range } from 'vscode';
import { parse } from 'acorn';
import Parser from './Parser';


function findVariableDeclaration(body, name) {
    for (const statement of body) {
        if (statement.type === 'VariableDeclaration') {
            for (const declaration of statement.declarations) {
                if (declaration.type === 'VariableDeclarator' && declaration.id.name === name) {
                    if (declaration.init.type === 'ArrayExpression') {
                        return declaration.init.elements;
                    } else if (declaration.init.type === 'Identifier') {
                        return findVariableDeclaration(body, declaration.init.name);
                    }
                }
            }
        }
    }

    return [];
}

function isModuleExports(statement) {
    try {
        return (
            statement.type === 'ExpressionStatement' &&
            statement.expression.type === 'AssignmentExpression' &&
            statement.expression.left.object.name === 'module' &&
            statement.expression.left.property.name === 'exports'
        );
    } catch(err) {
        return false;
    }
}

function getConfigElements(body) {
    for (const statement of body) {
        // default export
        if (statement.type === 'ExportDefaultDeclaration') {
            // initialized
            if (statement.declaration.type === 'ArrayExpression') {
                return statement.declaration.elements;
            // assigned variable value
            } else if (statement.declaration.type === 'Identifier') {
                return findVariableDeclaration(body, statement.declaration.name);
            }
        // module.exports
        } else if (isModuleExports(statement)) {
            // initialized
            if (statement.expression.right.type === 'ArrayExpression') {
                return statement.expression.right.elements;
            // assigned variable value
            } else if (statement.expression.right.type === 'Identifier') {
                return findVariableDeclaration(body, statement.expression.right.name);
            }
        }
    }

    return [];
}

function isRulesProperty(prop) {
    return (
        prop.type === 'Property' && (
            (
                prop.key.type === 'Identifier' &&
                prop.key.name === 'rules'
            ) || (
                prop.key.type === 'Literal' &&
                prop.key.value === 'rules'
            )
        ) &&
        prop.value.type === 'ObjectExpression'
    );
}

function collectConfiguredRules(elements) {
    const rules = [];

    for (const element of elements) {
        if (element.type === 'ObjectExpression') {
            for (const prop of element.properties) {
                if (isRulesProperty(prop)) {
                    rules.push(...prop.value.properties.filter(({ type }) => type === 'Property'));
                }
            }
        }
    }

    return rules;
}


export default class FlatConfigParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const ast = parse(this.document.getText(), { locations: true, sourceType: 'module' });

        const configArray = getConfigElements(ast.body);
        const configuredRules = collectConfiguredRules(configArray);

        return configuredRules.map(rule => {
            const keyStartPosition = new Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
            const keyEndPosition = new Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
            const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
            const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));
        
            let name;
            if (rule.key.type === 'Literal') {
                name = rule.key.value;
            } else if (rule.key.type === 'Identifier') {
                name = rule.key.name;
            }
        
            return {
                name: name ?? 'Unknown',
                keyRange,
                lineEndingRange
            };
        });
    }
};
