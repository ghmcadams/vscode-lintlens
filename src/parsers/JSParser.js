import { Position, Range } from 'vscode';
import { basename } from 'path';
import { parse } from 'acorn';
import { parse as parseLoose } from 'acorn-loose';
import { full as walkAST } from 'acorn-walk';
import { jsonrepair } from 'jsonrepair';
import Parser from './Parser';


function getVariableValueFromBody(body, name) {
    // TODO: get all variable value settings as well (variable set after declared)
    //    EX:
    //    1:  let config;
    //    ...
    //    4:  config = {};

    for (const statement of body) {
        if (statement.type === 'VariableDeclaration') {
            for (const declaration of statement.declarations) {
                if (declaration.type === 'VariableDeclarator' && declaration.id.name === name) {
                    // TODO: what other types could there be? (spread?)
                    if (declaration.init.type === 'Identifier') {
                        return getVariableValueFromBody(body, declaration.init.name);
                    }
                    return declaration.init;
                }
            }
        }
    }

    return null;
}

function getPropertyByName(object, name) {
    if (object?.type !== 'ObjectExpression') {
        return null;
    }

    const realProperties = getRealProperties(object.properties);
    for (const prop of realProperties) {
        if (isCorrectProperty(prop, name)) {
            return getRealValue(prop.value);
        }
    }

    return null;
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

function isCorrectProperty(prop, name) {
    return (
        prop.type === 'Property' && (
            (
                prop.key.type === 'Identifier' &&
                prop.key.name === name
            ) || (
                prop.key.type === 'Literal' &&
                prop.key.value === name
            )
        )
    );
}

function getRealValue(value) {
    if (value.type === 'Identifier') {
        return getVariableValueFromBody(value.body, value.name);
    } else if (value.type === 'SpreadElement') {
        switch (value.argument.type) {
            case 'Identifier':
                return getVariableValueFromBody(value.body, value.argument.name);
            case 'MemberExpression':
                if (!value.argument.object.name) {
                    return null;
                }

                // TODO: this does not work when chained objects (ex: obj1.obj2.obj3.val)
                //  I need to do more to get it - EX: value.argument.object.object.object.name (only gives me obj1)
                const variableValue = getVariableValueFromBody(value.body, value.argument.object.name);

                if (variableValue?.type === 'ObjectExpression') {
                    return getPropertyByName(variableValue, value.argument.property.name);
                }
                if (variableValue?.type === 'ArrayExpression' && value.argument.property.type === 'Literal') {
                    return variableValue.elements[value.argument.property.value];
                }
            default:
                return null;
        }
    }

    return value;
}

function getRealProperties(properties) {
    const realProperties = [];

    for (const prop of properties) {
        const realProp = getRealValue(prop);
        if (realProp?.type === 'ObjectExpression') {
            realProperties.push(...getRealProperties(realProp.properties));
        } else if (realProp.type === 'Property') {
            realProperties.push(realProp);
        }
    }

    return realProperties;
}

function getRealElements(elements) {
    const newElements = [];
    elements.forEach(element => {
        const realElement = getRealValue(element);
        if (realElement !== null) {
            if (element.type === 'SpreadElement' && realElement?.type === 'ArrayExpression') {
                newElements.push(...getRealElements(realElement.elements));
            } else {
                newElements.push(realElement);
            }
        }
    });
    return newElements;
}

function getAllContainers(container) {
    const realContainer = getRealValue(container);

    if (realContainer?.type === 'ObjectExpression') {
        const containers = [realContainer];

        // If there are any spreads, get those, too
        for (const prop of realContainer.properties) {
            const realProp = getRealValue(prop);
            if (realProp?.type === 'ObjectExpression') {
                containers.push(...getAllContainers(realProp));
            }
        }

        return [...new Set(containers)];
    }

    return [];
}


function getASTBody(document) {
    let documentText = document.getText();
    const languageId = document.languageId;

    const parseOptions = {
        ecmaVersion: "latest",
        sourceType: "module",
        allowReserved: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowSuperOutsideMethod: true,
        locations: true
    };

    if (languageId === 'json' || languageId === 'jsonc') {
        // return parseExpressionAt(documentText, 0, parseOptions);
        documentText = `export default ${documentText}`;
    }
    
    let ast;
    try {
        ast = parse(documentText, parseOptions);
    } catch(err) {
        try {
            ast = parseLoose(documentText, parseOptions);
        } catch(err) {
            return null;
        }
    }

    walkAST(ast, (node) => {
        node.body = ast.body;
    });

    return ast.body;
}

function getConfigRoot(body, propertyName = null) {
    const mainExport = getMainExport(body);

    if (propertyName !== null) {
        return getPropertyByName(mainExport, propertyName);
    }

    return mainExport;
}

function getMainExport(body) {
    for (const statement of body) {
        if (statement.type === 'ExportDefaultDeclaration' || isModuleExports(statement)) {
            const attemptedValue = statement.type === 'ExportDefaultDeclaration'
                // default export
                ? statement.declaration
                // module.exports
                : statement.expression.right;

            return getRealValue(attemptedValue);
        }
    }

    return null;
}

function getOverrides(config) {
    const realProperties = getRealProperties(config.properties);

    for (const prop of realProperties) {
        if (isCorrectProperty(prop, 'overrides')) {
            const realOverrides = getRealValue(prop.value);
            return getRealElements(realOverrides.elements);
        }
    }

    return [];
}

function getRulesContainers(config) {
    if (!config?.properties || config.properties.length === 0) {
        return [];
    }

    const realProperties = getRealProperties(config.properties);

    for (const prop of realProperties) {
        if (isCorrectProperty(prop, 'rules')) {
            return getAllContainers(prop.value);
        }
    }

    return [];
}

function getRange(document, statement) {
    if (!statement || (Array.isArray(statement) && statement.length === 0)) {
        return null;
    }

    const statements = Array.isArray(statement) ? statement : [statement];

    const startPosition = new Position(statements.at(0).loc.start.line - 1, statements.at(0).loc.start.column);
    const endPosition = new Position(statements.at(-1).loc.end.line - 1, statements.at(-1).loc.end.column);

    return document.validateRange(new Range(startPosition, endPosition));
}

function readRuleValue(document, ruleValueAST) {
    try {
        if (ruleValueAST.type === 'Literal') {
            return ruleValueAST.value;
        }
        if (ruleValueAST.type === 'Identifier') {
            const variableAST = getVariableValueFromBody(ruleValueAST.body, ruleValueAST.name);
            return variableAST?.value ?? null;
        }

        if (ruleValueAST.type === 'ArrayExpression') {
            const severityAST = ruleValueAST.elements[0];
            const optionsAST = ruleValueAST.elements.slice(1);

            let severity;
            if (severityAST.type === 'Literal') {
                severity = severityAST.value;
            }
            if (severityAST.type === 'Identifier') {
                const variableAST = getVariableValueFromBody(ruleValueAST.body, severityAST.name);
                severity = variableAST?.value ?? null;
            }

            const optionsRange = getRange(document, optionsAST);
            const optionsText = document.getText(optionsRange);
            const options = (optionsAST?.length ?? 0) > 0 && JSON.parse(jsonrepair(optionsText));
            const optionsAsArray = Array.isArray(options) ? options : [options];

            return [
                severity,
                ...(options ? optionsAsArray :[])
            ];
        }

        return null;
    } catch(err) {
        return null;
    }
}

function getRules(document, container) {
    return container.properties
        .filter(rule => rule.type === 'Property')
        .map(rule => getRuleDetails(document, rule));
}

function getRuleDetails(document, rule) {
    const range = getRange(document, rule);
    const lineEndingRange = document.validateRange(new Range(rule.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

    // key
    let name = 'Unknown';
    if (rule.key.type === 'Literal') {
        name = rule.key.value;
    } else if (rule.key.type === 'Identifier') {
        name = rule.key.name;
    }
    const keyRange = getRange(document, rule.key);

    // loose parsing allowed invalid syntax
    if (range.isEqual(keyRange)) {
        return {
            name,
            range,
            key: {
                range
            },
            lineEndingRange
        };
    }

    // configuration
    const configurationRange = getRange(document, rule.value);
    let severityRange, optionsRange;
    if (rule.value.type === 'ArrayExpression') {
        severityRange = getRange(document, rule.value.elements[0]);
        optionsRange = getRange(document, rule.value.elements.slice(1));
    } else if (rule.value.type === 'Literal' || rule.value.type === 'Identifier') {
        severityRange = getRange(document, rule.value);
    }
    const optionsConfig = readRuleValue(document, rule.value);

    return {
        name,
        range,
        key: {
            range: keyRange
        },
        configuration: {
            range: configurationRange,
            severityRange,
            optionsRange,
            value: optionsConfig
        },
        lineEndingRange
    };
}

export const ESLintConfigType = {
    Legacy: 'Legacy',
    Flat: 'Flat',
    Unknown: 'Unknown',
};

export default class JSParser extends Parser {
    constructor(document, options = {}) {
        super(document);

        // TODO: make sure these are one of the allowed options
        const defaultedOptions = {
            configType: options.configType ?? ESLintConfigType.Unknown,
        };
        this.options = defaultedOptions;
    }

    parse() {
        const body = getASTBody(this.document);
        const fileName = basename(this.document.fileName);
        const configPropertyName = fileName === 'package.json' ? 'eslintConfig' : null;

        const configRoot = getConfigRoot(body, configPropertyName);
        if (configRoot === null) {
            return null;
        }
        if (this.options.configType === ESLintConfigType.Legacy && configRoot.type !== 'ObjectExpression') {
            return null;
        }
        if (this.options.configType === ESLintConfigType.Flat && configRoot.type !== 'ArrayExpression') {
            return null;
        }
        if (!['ObjectExpression', 'ArrayExpression'].includes(configRoot.type)) {
            return null;
        }

        // Determine type based on export
        if (this.options.configType === ESLintConfigType.Unknown) {
            this.options.configType = configRoot.type === 'ArrayExpression' ? ESLintConfigType.Flat : ESLintConfigType.Legacy;
        }

        let sections;
        if (this.options.configType === ESLintConfigType.Flat) {
            sections = getRealElements(configRoot.elements);
        } else if (this.options.configType === ESLintConfigType.Legacy) {
            const overrides = getOverrides(configRoot);

            // one entry for the main config
            // and one for each overrides
            sections = [
                configRoot,
                ...overrides
            ];
        }

        return sections.map(section => {
            // TODO: Plugins and Extends

            // const extendsContainers = getExtendsContainers(section);
            // const pluginsContainers = getPluginsContainers(section);
            const rulesContainers = getRulesContainers(section);

            // const extendsValue = {
            //     containers: extendsContainers.map(container => getRange(this.document, container)),
            //     entries: null
            // };
            // const pluginsValue = {
            //     containers: pluginsContainers.map(container => getRange(this.document, container)),
            //     entries: null
            // };
            const rulesValue = rulesContainers.map(container => {
                return {
                    range: getRange(this.document, container),
                    entries: getRules(this.document, container)
                };
            });

            return {
                // extends: extendsValue,
                // plugins: pluginsValue,
                rules: rulesValue
            };
        });
    }
};
