import { Position, Range } from 'vscode';
import { parse } from 'acorn';
import { jsonrepair } from 'jsonrepair';
import Parser from './Parser';


function getVariableFromBody(body, name) {
    for (const statement of body) {
        if (statement.type === 'VariableDeclaration') {
            for (const declaration of statement.declarations) {
                if (declaration.type === 'VariableDeclarator' && declaration.id.name === name) {
                    if (declaration.init.type === 'Identifier') {
                        return getPropertiesFromVariable(body, declaration.init.name);
                    }
                    return declaration.init;
                }
            }
        }
    }

    return null;
}

function getProperties(body, elements) {
    const properties = [];

    for (const element of elements) {
        if (element.type === 'ObjectExpression') {
            properties.push(...element.properties);
        } else if (element.type === 'SpreadElement' && element.argument.type === 'Identifier') {
            properties.push(...getPropertiesFromVariable(body, element.argument.name));
        }
    }

    return properties;
}

function getPropertiesFromVariable(body, name) {
    const variable = getVariableFromBody(body, name);
    if (variable.type === 'ArrayExpression') {
        return getProperties(body, variable.elements);
    } else if (variable.type === 'ObjectExpression') {
        return variable.properties;
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

function getConfigProperties(body) {
    for (const statement of body) {
        // default export
        if (statement.type === 'ExportDefaultDeclaration') {
            // initialized
            if (statement.declaration.type === 'ObjectExpression') {
                return statement.declaration.properties;
            // assigned variable value
            } else if (statement.declaration.type === 'Identifier') {
                return getPropertiesFromVariable(body, statement.declaration.name);
            }
        // module.exports
        } else if (isModuleExports(statement)) {
            // initialized
            if (statement.expression.right.type === 'ObjectExpression') {
                return statement.expression.right.properties;
            // assigned variable value
            } else if (statement.expression.right.type === 'Identifier') {
                return getPropertiesFromVariable(body, statement.expression.right.name);
            }
        }
    }

    return [];
}

function isRulesProperty(prop) {
    return (
        (
            prop.key.type === 'Identifier' &&
            prop.key.name === 'rules'
        ) || (
            prop.key.type === 'Literal' &&
            prop.key.value === 'rules'
        )
    );
}

function isOverridesProperty(prop) {
    return (
        prop.type === 'Property' && (
            (
                prop.key.type === 'Identifier' &&
                prop.key.name === 'overrides'
            ) || (
                prop.key.type === 'Literal' &&
                prop.key.value === 'overrides'
            )
        ) &&
        prop.value.type === 'ArrayExpression'
    );
}

function getRules(body, properties) {
    const rules = [];

    for (const prop of properties) {
        if (prop.type === 'SpreadElement' && prop.argument.type === 'Identifier') {
            rules.push(...getRules(body, getPropertiesFromVariable(body, prop.argument.name)));
        } else if (isRulesProperty(prop)) {
            if (prop.value.type === 'Identifier') {
                rules.push(...getPropertiesFromVariable(body, prop.value.name));
            }

            if (prop.value.type === 'ObjectExpression') {
                for (const rulesProp of prop.value.properties) {
                    if (rulesProp.type === 'SpreadElement' && rulesProp.argument.type === 'Identifier') {
                        rules.push(...getPropertiesFromVariable(body, rulesProp.argument.name));
                    } else if (rulesProp.type === 'Property') {
                        rules.push(rulesProp);
                    }
                }
            }
        } else if (isOverridesProperty(prop)) {
            for (const element of prop.value.elements) {
                if (element.type === 'ObjectExpression') {
                    rules.push(...getRules(body, element.properties));
                }
            }
        }
    }

    // TODO: augment with anything that messes with the variable after assignment (EX: reassignment or setting object property externally, etc.)

    return rules;
}

function readRuleConfig(documentText, bodyAST, ruleValueAST) {
    try {
        if (ruleValueAST.type === 'Literal') {
            return ruleValueAST.value;
        }
        if (ruleValueAST.type === 'Identifier') {
            const variableAST = getVariableFromBody(bodyAST, ruleValueAST.name);
            return variableAST?.value ?? null;
        }

        if (ruleValueAST.type === 'ArrayExpression') {
            const severityAST = ruleValueAST.elements[0];
            const optionsAST = ruleValueAST.elements[1];

            let severity;
            if (severityAST.type === 'Literal') {
                severity = severityAST.value;
            }
            if (severityAST.type === 'Identifier') {
                const variableAST = getVariableFromBody(bodyAST, severityAST.name);
                severity = variableAST?.value ?? null;
            }

            const options = optionsAST && JSON.parse(jsonrepair(documentText.slice(optionsAST.start, optionsAST.end)));

            return [
                severity,
                ...(options ? [options] :[])
            ];
        }

        return null;
    } catch(err) {
        return null;
    }
}

function getRange(document, statement) {
    if (!statement) {
        return null;
    }

    const keyStartPosition = new Position(statement.loc.start.line - 1, statement.loc.start.column);
    const keyEndPosition = new Position(statement.loc.end.line - 1, statement.loc.end.column);

    return document.validateRange(new Range(keyStartPosition, keyEndPosition));
}


export default class JSParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const documentText = this.document.getText();
        const ast = parse(documentText, { locations: true, sourceType: 'module', ecmaVersion: 2020 });

        const configProperties = getConfigProperties(ast.body);
        const configuredRules = getRules(ast.body, configProperties);

        return configuredRules.map(rule => {
            const keyRange = getRange(this.document, rule.key);

            let severityRange, optionsRange;
            if (rule.value.type === 'ArrayExpression') {
                severityRange = getRange(this.document, rule.value.elements[0]);
                optionsRange = getRange(this.document, rule.value.elements[1]);
            } else if (rule.value.type === 'Literal') {
                severityRange = getRange(this.document, rule.value);
            }
            const optionsConfig = readRuleConfig(documentText, ast.body, rule.value);

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
                severityRange,
                optionsRange,
                optionsConfig,
                lineEndingRange
            };
        });
    }
};
