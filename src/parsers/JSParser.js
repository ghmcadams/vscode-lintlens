import { Position, Range } from 'vscode';
import { parse, parseExpressionAt } from 'acorn';
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

function getPropertyByName(body, object, name) {
    if (object.type !== 'ObjectExpression') {
        return null;
    }

    const realProperties = getRealProperties(body, object.properties);
    for (const prop of realProperties) {
        if (isCorrectProperty(prop, name)) {
            return getRealValue(body, prop.value);
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

function getRealValue(body, value) {
    if (value.type === 'Identifier') {
        return getVariableValueFromBody(body, value.name);
    } else if (value.type === 'SpreadElement') {
        switch (value.argument.type) {
            case 'Identifier':
                return getVariableValueFromBody(body, value.argument.name);
            case 'MemberExpression':
                if (!value.argument.object.name) {
                    return null;
                }

                // TODO: this does not work when chained objects (ex: obj1.obj2.obj3.val)
                //  I need to do more to get it - EX: value.argument.object.object.object.name (only gives me obj1)
                const variableValue = getVariableValueFromBody(body, value.argument.object.name);

                if (variableValue?.type === 'ObjectExpression') {
                    return getPropertyByName(body, variableValue, value.argument.property.name);
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

function getRealProperties(body, properties) {
    const realProperties = [];

    for (const prop of properties) {
        const realProp = getRealValue(body, prop);
        if (realProp?.type === 'ObjectExpression') {
            realProperties.push(...getRealProperties(body, realProp.properties));
        } else if (realProp.type === 'Property') {
            realProperties.push(realProp); // TODO: used to be prop - which is correct?
        }
    }

    return realProperties;
}

function getRealElements(body, elements) {
    const newElements = [];
    elements.forEach(element => {
        const realElement = getRealValue(body, element);
        if (realElement !== null) {
            if (element.type === 'SpreadElement' && realElement?.type === 'ArrayExpression') {
                newElements.push(...getRealElements(body, realElement.elements)); // added the recursion here - is it correct?
            } else {
                newElements.push(realElement);
            }
        }
    });
    return newElements;
}

function getAllContainers(body, container) {
    const realContainer = getRealValue(body, container);

    if (realContainer?.type === 'ObjectExpression') {
        const containers = [realContainer];

        // If there are any spreads, get those, too
        for (const prop of realContainer.properties) {
            const realProp = getRealValue(body, prop);
            if (realProp?.type === 'ObjectExpression') {
                containers.push(...getAllContainers(body, realProp));
            }
        }

        return [...new Set(containers)];
    }

    return [];
}


function getASTBody(document, fileType) {
    const documentText = document.getText();

    if ([ESLintFileType.JSON, ESLintFileType.PKG].includes(fileType)) {
        return parseExpressionAt(documentText, 0, { locations: true, ecmaVersion: 2020 });
    }

    const ast = parse(documentText, { locations: true, sourceType: 'module', ecmaVersion: 2020 });
    return ast.body;
}

function getConfigRoot(body, fileType) {
    let configRoot;

    if (fileType === ESLintFileType.JSON) {
        configRoot = body;
    } else if (fileType === ESLintFileType.PKG) {
        configRoot = getPropertyByName(body, body, 'eslintConfig');
    } else {
        configRoot = getMainExport(body);
    }

    return configRoot ?? null;
}

function getMainExport(body) {
    for (const statement of body) {
        if (statement.type === 'ExportDefaultDeclaration' || isModuleExports(statement)) {
            const attemptedValue = statement.type === 'ExportDefaultDeclaration'
                // default export
                ? statement.declaration
                // module.exports
                : statement.expression.right;

            return getRealValue(body, attemptedValue);
        }
    }

    return null;
}

function getOverrides(body, config) {
    const realProperties = getRealProperties(body, config.properties);

    for (const prop of realProperties) {
        if (isCorrectProperty(prop, 'overrides')) {
            const realOverrides = getRealValue(body, prop.value);

            // TODO: should this be using getRealElements() ?
            const overrides = [];
            for (const element of realOverrides?.elements ?? []) {
                const value = getRealValue(body, element);
                if (value?.type === 'ObjectExpression') {
                    overrides.push(value);
                }
            }
            return overrides;
        }
    }

    return [];
}

function getRulesContainers(body, config) {
    if (!config?.properties || config.properties.length === 0) {
        return [];
    }

    const realProperties = getRealProperties(body, config.properties);

    for (const prop of realProperties) {
        if (isCorrectProperty(prop, 'rules')) {
            return getAllContainers(body, prop.value);
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

function readRuleValue(document, bodyAST, ruleValueAST) {
    try {
        if (ruleValueAST.type === 'Literal') {
            return ruleValueAST.value;
        }
        if (ruleValueAST.type === 'Identifier') {
            const variableAST = getVariableValueFromBody(bodyAST, ruleValueAST.name);
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
                const variableAST = getVariableValueFromBody(bodyAST, severityAST.name);
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

function getRules(document, body, containers) {
    return containers
        .flatMap(container => container.properties)
        .filter(rule => rule.type === 'Property')
        .map(rule => getRuleDetails(document, body, rule));
}

function getRuleDetails(document, body, rule) {
    const keyRange = getRange(document, rule.key);

    let severityRange, optionsRange;
    if (rule.value.type === 'ArrayExpression') {
        severityRange = getRange(document, rule.value.elements[0]);
        optionsRange = getRange(document, rule.value.elements.slice(1));
    } else if (rule.value.type === 'Literal' || rule.value.type === 'Identifier') {
        severityRange = getRange(document, rule.value);
    }
    const optionsConfig = readRuleValue(document, body, rule.value);

    const lineEndingRange = document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

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
}

export const ESLintConfigType = {
    Legacy: 'Legacy',
    Flat: 'Flat',
    Unknown: 'Unknown',
};

export const ESLintFileType = {
    JS: 'JS',
    JSON: 'JSON',
    PKG: 'PKG',
};

export default class JSParser extends Parser {
    constructor(document, options = {}) {
        super(document);

        // TODO: make sure these are one of the allowed options
        const defaultedOptions = {
            fileType: options.fileType ?? ESLintFileType.JS,
            configType: options.configType ?? ESLintConfigType.Unknown,
        };
        this.options = defaultedOptions;
    }

    parse({
        containersOnly = false
    } = {}) {
        const body = getASTBody(this.document, this.options.fileType);

        const configRoot = getConfigRoot(body, this.options.fileType);
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
            sections = getRealElements(body, configRoot.elements);
        } else if (this.options.configType === ESLintConfigType.Legacy) {
            const overrides = getOverrides(body, configRoot);

            // one entry for the main config
            // and one for each overrides
            sections = [
                configRoot,
                ...overrides
            ];
        }

        return sections.map(section => {
            // TODO: Plugins and Extends

            // const extendsContainers = getExtendsContainers(body, section);
            // const pluginsContainers = getPluginsContainers(body, section);
            const rulesContainers = getRulesContainers(body, section);

            // const extendsValue = {
            //     containers: extendsContainers.map(container => getRange(this.document, container)),
            //     entries: null
            // };
            // const pluginsValue = {
            //     containers: pluginsContainers.map(container => getRange(this.document, container)),
            //     entries: null
            // };
            const rulesValue = {
                containers: rulesContainers.map(container => getRange(this.document, container)),
                entries: null
            };

            if (containersOnly !== true) {
                // const extendsValue = extendsContainers.flatMap(container => getRealProperties(body, container.properties));
                // const pluginsValue = pluginsContainers.flatMap(container => getRealProperties(body, container.properties));

                rulesValue.entries = getRules(this.document, body, rulesContainers);
            }

            return {
                // extends: extendsValue,
                // plugins: pluginsValue,
                rules: rulesValue
            };
        });
    }
};
