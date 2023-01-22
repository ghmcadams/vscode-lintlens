import { Position, Range } from 'vscode';
import { basename } from 'path';
import { parse } from 'acorn';
import { parse as parseLoose, isDummy } from 'acorn-loose';
import * as walk from 'acorn-walk';
import { generate } from 'escodegen';
import deepClone from 'deep-clone';
import Parser, { EntryType } from './Parser';


const acornParserOptions = {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReserved: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true,
    locations: true
};


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
                    if (['CallExpression', 'MemberExpression'].includes(declaration.init.type)) {
                        // TODO: support MemberExpression, CallExpression
                        return null;
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


function getASTBody(text, languageId) {
    let documentText = text;

    if (languageId === 'json' || languageId === 'jsonc') {
        documentText = `export default ${documentText}`;
    }
    
    let ast;
    try {
        ast = parse(documentText, acornParserOptions);
    } catch(err) {
        try {
            ast = parseLoose(documentText, acornParserOptions);
        } catch(err) {
            return null;
        }
    }

    walk.full(ast, (node) => {
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

function getRange(statement) {
    if (!statement || (Array.isArray(statement) && statement.length === 0)) {
        return null;
    }

    const statements = Array.isArray(statement) ? statement : [statement];

    const startPosition = new Position(statements.at(0).loc.start.line - 1, statements.at(0).loc.start.column);
    const endPosition = new Position(statements.at(-1).loc.end.line - 1, statements.at(-1).loc.end.column);

    return new Range(startPosition, endPosition);
}

function unparseAST(ast) {
    // replace pointers with real values
    walk.full(ast, (node) => {
        const realValue = getRealValue(node);
        if (realValue === null) {
            node.type = 'Literal';
            node.value = "";
            node.raw = "\"\"";
        } else if (node !== realValue) {
            for (const [key, value] of Object.entries(realValue)) {
                node[key] = value;
            }
        }
    });

    // fix unquoted JSON keys
    walk.simple(ast, {
        Property({ key }) {
            if (key.type === 'Identifier') {
                key.type = 'Literal';
                key.value = key.name;
                key.raw = `"${key.value}"`;
            }
        }
    });

    const json = generate(ast, {
        format: {
            quotes: 'double',
            compact: true
        }
    });

    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}

function readRuleValue(ruleValueAST) {
    try {
        if (ruleValueAST.type === 'Literal') {
            return ruleValueAST.value;
        }
        if (ruleValueAST.type === 'Identifier') {
            const variableAST = getVariableValueFromBody(ruleValueAST.body, ruleValueAST.name);
            return variableAST?.value ?? null;
        }

        if (ruleValueAST.type === 'ArrayExpression') {
            const ruleValueCopy = deepClone(ruleValueAST);
            return unparseAST(ruleValueCopy);
        }

        return null;
    } catch(err) {
        return null;
    }
}

function getRuleEntries(container) {
    return container.properties
        .map(entry => {
            if (entry.type !== 'Property') {
                return getPointerDetails(entry);
            }

            if (isDummy(entry.value)) {
                return getEmptyValueDetails(entry);
            }
            if (entry.key.type === 'Literal' &&
                entry.start === entry.key.start &&
                entry.end === entry.key.end
            ) {
                return getEmptyRuleDetails(entry);
            }

            return getRuleDetails(entry);
        });
}

function getPointerDetails(entry) {
    const range = getRange(entry);
    // TODO: use actual document text for pointer name
    const name = entry.type === 'Identifier' ? entry.key.name : '';

    return {
        type: EntryType.Pointer,
        range,
        name
    }
}

function getEmptyRuleDetails(entry) {
    const range = getRange(entry);

    return {
        type: EntryType.EmptyRule,
        range
    }
}

function getEmptyValueDetails(entry) {
    const range = getRange(entry);

    // when acorn loose adds a dummy value, the key contains the colon
    // TODO: make this cleaner (I want ALL the space after the colon, no matter what is there)
    return {
        type: EntryType.EmptyValue,
        range,
        valueRange: new Range(entry.key.loc.end.line - 1, entry.key.loc.end.column + 1, entry.value.loc.end.line - 1, entry.value.loc.end.column)
    }
}

function getRuleDetails(rule) {
    const range = getRange(rule);
    const lineEndingRange = new Range(rule.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.loc.start.line - 1, Number.MAX_SAFE_INTEGER);

    // key
    let name = 'Unknown';
    if (rule.key.type === 'Literal') {
        name = rule.key.value;
    } else if (rule.key.type === 'Identifier') {
        name = rule.key.name;
    }
    const keyRange = getRange(rule.key);

    // configuration
    const configurationRange = getRange(rule.value);
    let severityRange, optionsRange;
    if (rule.value.type === 'ArrayExpression') {
        severityRange = getRange(rule.value.elements[0]);
        optionsRange = getRange(rule.value.elements.slice(1));
    } else if (rule.value.type === 'Literal' || rule.value.type === 'Identifier') {
        severityRange = getRange(rule.value);
    }
    const optionsConfig = readRuleValue(rule.value);

    return {
        type: EntryType.Rule,
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
        const documentText = this.document.getText();
        const body = getASTBody(documentText, this.document.languageId);
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
            // const extendsValue = 

            // const pluginsContainers = getPluginsContainers(section);
            // const pluginsValue = 

            const rulesContainers = getRulesContainers(section);
            const rulesValue = rulesContainers.map(container => {
                const range = getRange(container);
                const entries = getRuleEntries(container);

                return {
                    range,
                    entries
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
