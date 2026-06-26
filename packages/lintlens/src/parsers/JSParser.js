import { Position, Range } from 'vscode';
import { basename } from 'path';
import { parse } from 'acorn';
import { parse as parseLoose, isDummy } from 'acorn-loose';
import * as walk from 'acorn-walk';
import { transform } from 'sucrase';
import { generate } from 'astring';
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
                if (declaration.type !== 'VariableDeclarator' || declaration.init == null) {
                    continue;
                }

                if (declaration.id.type === 'Identifier' && declaration.id.name === name) {
                    if (declaration.init.type === 'Identifier') {
                        return getVariableValueFromBody(body, declaration.init.name);
                    }
                    if (['CallExpression', 'MemberExpression'].includes(declaration.init.type)) {
                        return getRealValue(declaration.init);
                    }
                    return declaration.init;
                }

                if (declaration.id.type === 'ObjectPattern') {
                    const targetObject = getRealValue(declaration.init);
                    if (targetObject?.type !== 'ObjectExpression') {
                        continue;
                    }

                    for (const property of declaration.id.properties) {
                        if (property.type !== 'Property') {
                            continue;
                        }

                        let localName = null;
                        if (property.value.type === 'Identifier') {
                            localName = property.value.name;
                        } else if (property.value.type === 'AssignmentPattern' && property.value.left.type === 'Identifier') {
                            localName = property.value.left.name;
                        }

                        if (localName !== name) {
                            continue;
                        }

                        const propertyName = property.key.type === 'Identifier'
                            ? property.key.name
                            : property.key.type === 'Literal'
                                ? property.key.value
                                : null;

                        if (propertyName === null) {
                            continue;
                        }

                        return getPropertyByName(targetObject, propertyName);
                    }
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

function unwrapCallExpression(value) {
    if (value.type !== 'CallExpression' || !value.arguments?.length) {
        return null;
    }

    for (const arg of value.arguments) {
        const realArg = getRealValue(arg);
        if (realArg?.type === 'ArrayExpression' || realArg?.type === 'ObjectExpression') {
            return realArg;
        }
    }

    return null;
}

function getRealValue(value) {
    if (value.type === 'Identifier') {
        return getVariableValueFromBody(value.body, value.name);
    } else if (value.type === 'CallExpression') {
        return unwrapCallExpression(value) ?? value;
    } else if (value.type === 'MemberExpression') {
        const objectValue = getRealValue(value.object);
        if (!objectValue) {
            return null;
        }

        let propertyName;
        if (value.computed) {
            if (value.property.type !== 'Literal') {
                return null;
            }
            propertyName = value.property.value;
        } else {
            if (value.property.type === 'Identifier') {
                propertyName = value.property.name;
            } else if (value.property.type === 'Literal') {
                propertyName = value.property.value;
            }
        }

        if (propertyName === undefined || propertyName === null) {
            return null;
        }

        if (objectValue.type === 'ObjectExpression') {
            return getPropertyByName(objectValue, propertyName);
        }

        if (objectValue.type === 'ArrayExpression' && Number.isInteger(propertyName)) {
            return objectValue.elements[propertyName];
        }

        return null;
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
        } else if (realProp?.type === 'Property') {
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
    } else if (realContainer?.type === 'ArrayExpression') {
        const containers = [realContainer];

        // If there are any spreads, get those, too
        for (const element of realContainer.elements) {
            const realElement = getRealValue(element);
            if (realElement?.type === 'ArrayExpression') {
                containers.push(...getAllContainers(realElement));
            }
        }

        return [...new Set(containers)];
    }

    return [];
}


function getASTBody(text, languageId, optionsOverrides = {}) {
    let documentText = text;

    if (languageId === 'json' || languageId === 'jsonc') {
        documentText = `export default ${documentText}`;
    }

    if (languageId === 'typescript') {
        try {
            documentText = transform(documentText, {
                transforms: ['typescript'],
            }).code;
        } catch (err) {
            return null;
        }
    }

    const options = {
        ...acornParserOptions,
        ...optionsOverrides
    };

    let ast;
    try {
        ast = parse(documentText, options);
    } catch(err) {
        try {
            ast = parseLoose(documentText, options);
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
            if (statement.type === 'ExportDefaultDeclaration') {
                return getRealValue(statement.declaration);
            }

            return getRealValue(statement.expression.right);
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

function getContainers(config) {
    if (!config?.properties?.length) {
        return {};
    }

    const containers = {};

    const realProperties = getRealProperties(config.properties);

    for (const prop of realProperties) {
        if (isCorrectProperty(prop, 'plugins')) {
            containers.plugins = getAllContainers(prop.value);
        }

        if (isCorrectProperty(prop, 'rules')) {
            containers.rules = getAllContainers(prop.value);
        }
    }

    return containers;
}

function getRange(statement, type) {
    if (!statement || (Array.isArray(statement) && statement.length === 0)) {
        return null;
    }

    const statements = Array.isArray(statement) ? statement : [statement];

    const startPosition = new Position(statements.at(0).loc.start.line - 1, statements.at(0).loc.start.column);
    const endPosition = new Position(statements.at(-1).loc.end.line - 1, statements.at(-1).loc.end.column);

    const range = new Range(startPosition, endPosition);
    range.type = type;

    return range;
}

function repairJSONAST(ast) {
    walk.full(ast, (node) => {
        // fix quotes
        if (node.type === 'Literal' && node.value.replace) {
            const newRaw = node.value
                .replace(/^[\'\"\`](.*)[\'\"\`]$/, '$1')
                .replaceAll(/\"/g, '\'');
            node.raw = `"${newRaw}"`;
            return;
        }
        if (node.type === 'TemplateLiteral') {
            node.type = 'Literal';
            node.value = node.quasis.map(item => item.value.raw.replace(/\"/g, '\'')).join('');
            node.raw = `"${node.value}"`;
            return;
        }

        if (node.type === 'Property') {
            // fix unquoted JSON keys
            if (node.key?.type === 'Literal' && node.key.value.replace) {
                const newRaw = node.key.value
                    .replace(/^[\'\"\`](.*)[\'\"\`]$/, '$1')
                    .replaceAll(/\"/g, '\'');
                    node.key.raw = `"${newRaw}"`;
            } else if (node.key?.type === 'Identifier') {
                node.key.type = 'Literal';
                node.key.value = node.key.name;
                node.key.raw = `"${node.key.name}"`;
            }
            return;
        }

        // replace pointers with real values
        const realValue = getRealValue(node);
        if (realValue === null) {
            node.type = 'Literal';
            node.value = "";
            node.raw = "\"\"";
            return;
        } else if (node !== realValue) {
            for (const [key, value] of Object.entries(realValue)) {
                node[key] = value;
            }
            return;
        }
    });

    return ast;
}

function unparseJSON(ast) {
    const repairedJson = repairJSONAST(ast);

    const json = generate(repairedJson, {
        indent: '',
        lineEnd: ''
    });

    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}

function readRuleValue(ruleValueAST) {
    try {
        if (ruleValueAST.type === 'Literal' || ruleValueAST.type === 'TemplateLiteral') {
            return ruleValueAST.value;
        }
        if (ruleValueAST.type === 'Identifier') {
            const variableAST = getVariableValueFromBody(ruleValueAST.body, ruleValueAST.name);
            return variableAST?.value ?? null;
        }

        if (ruleValueAST.type === 'ArrayExpression') {
            const ruleValueCopy = deepClone(ruleValueAST);
            ruleValueCopy.elements = getRealElements(ruleValueCopy.elements);
            return unparseJSON(ruleValueCopy);
        }

        return null;
    } catch(err) {
        return null;
    }
}

function getPluginEntries(container) {
    if (container.type === 'ObjectExpression') {
        return container.properties
            .map(entry => {
                if (entry.type !== 'Property') {
                    return getPointerDetails(entry);
                }
                if (entry.key &&
                    entry.key.type === 'Identifier' &&
                    entry.start === entry.key.start &&
                    entry.end === entry.key.end
                ) {
                    return getPointerDetails(entry);
                }

                if (entry.key.type === 'Literal' &&
                    entry.start === entry.key.start &&
                    entry.end === entry.key.end &&
                    entry.key.value === ''
                ) {
                    return getEmptyPluginKeyDetails(entry);
                }

                return getPluginDetails(entry);
            });
    } else if (container.type === 'ArrayExpression') {
        return container.elements
            .map(entry => {
                if (!['Literal', 'Identifier'].includes(entry.type)) {
                    return getPointerDetails(entry);
                }

                return getPluginDetails(entry);
            });
    }

    return [];
}

function getRuleEntries(container) {
    return container.properties
        .map(entry => {
            if (entry.type !== 'Property') {
                return getPointerDetails(entry);
            }
            if (entry.key &&
                entry.key.type === 'Identifier' &&
                entry.start === entry.key.start &&
                entry.end === entry.key.end
            ) {
                return getPointerDetails(entry);
            }

            if (entry.key.type === 'Literal' &&
                entry.start === entry.key.start &&
                entry.end === entry.key.end &&
                entry.key.value === ''
            ) {
                return getEmptyRuleKeyDetails(entry);
            }

            return getRuleDetails(entry);
        });
}

function getPointerDetails(entry) {
    const range = getRange(entry);

    let name;
    if (entry.key?.type === 'Identifier') {
        name = entry.key.name;
    }
    if (entry.type === 'SpreadElement' && entry.argument?.type === 'Identifier') {
        name = entry.argument.name;
    }

    // TODO: handle entry.argument.type = MemberExpression
    // make it work when chained objects (ex: obj1.obj2.obj3.val)
    //  I need to do more to get it - EX: entry.argument.object.object.object.name (only gives me obj1)

    return {
        type: EntryType.Pointer,
        range,
        name
    }
}

function getEmptyPluginKeyDetails(entry) {
    const range = getRange(entry);

    return {
        type: EntryType.EmptyPluginKey,
        range
    }
}

function getPluginDetails(plugin) {
    const pluginKey = plugin.key ? plugin.key : plugin;
    const pluginValue = plugin.key ? plugin.value : plugin;

    let key, value;
    if (pluginKey?.type === 'Literal') {
        key = pluginKey.value;
    } else if (pluginKey?.type === 'Identifier') {
        key = pluginKey.name;
    }
    if (pluginValue?.type === 'Literal') {
        value = pluginValue.value;
    } else if (pluginValue?.type === 'Identifier') {
        value = pluginValue.name;
    }

    return {
        type: EntryType.Plugin,
        range: getRange(plugin),
        key,
        value
    };
}

function getEmptyRuleKeyDetails(entry) {
    const range = getRange(entry);

    return {
        type: EntryType.EmptyRuleKey,
        range
    }
}

function getRuleDetails(rule) {
    const range = getRange(rule);

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
    let severityRange, optionsRange, optionsAst;
    if (rule.value.type === 'ArrayExpression') {
        severityRange = getRange(rule.value.elements[0]);
        optionsAst = rule.value.elements.slice(1);
        optionsRange = getRange(optionsAst);
    } else if (rule.value.type === 'Literal' || rule.value.type === 'TemplateLiteral' || rule.value.type === 'Identifier') {
        severityRange = getRange(rule.value);
    }
    const optionsConfig = readRuleValue(rule.value);
    const optionsLocations = getAstLocations(optionsAst);

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
            optionsLocations,
            value: optionsConfig
        }
    };
}

function getAstLocations(ast) {
    return ast === undefined ? undefined : ast.reduce((ret, curr, index) => {
        walk.fullAncestor(curr, (node, state, ancestors, type) => {
            if (type === 'Property') {
                return;
            }

            let key = `/${index}`;
            // last element = node, skip it
            ancestors.slice(0, -1).forEach((ancestorNode, idx) => {
                switch (ancestorNode.type) {
                    case 'ObjectExpression':
                        key += '/';
                        break;
                    case 'ArrayExpression':
                        const nextElement = ancestors[idx + 1];
                        key += `/${ancestorNode.elements.findIndex(element => element === nextElement)}`;
                        break;
                    case 'Property':
                        key += ancestorNode.key.type === 'Identifier' ? ancestorNode.key.name : ancestorNode.key.value;
                        break;
                }
            });

            ret[key] = node.loc;
        });

        return ret;
    }, {});
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

    getConfigSections(body) {
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

        return sections;
    }

    parse() {
        const documentText = this.document.getText();
        const body = getASTBody(documentText, this.document.languageId);
        const sections = this.getConfigSections(body);

        if (sections === null) {
            return null;
        }

        return sections.map(section => {
            const {
                plugins: pluginsContainers = [],
                rules: rulesContainers = []
            } = getContainers(section);

            const pluginsValue = pluginsContainers.map(container => {
                const range = getRange(container);
                const entries = getPluginEntries(container);

                return {
                    range,
                    entries
                };
            });

            const rulesValue = rulesContainers.map(container => {
                const range = getRange(container);
                const entries = getRuleEntries(container);

                return {
                    range,
                    entries
                };
            });

            return {
                plugins: pluginsValue,
                rules: rulesValue
            };
        });
    }

    getActiveRange(position) {
        const offset = this.document.offsetAt(position);

        const comments = [];
        const documentText = this.document.getText();
        const body = getASTBody(documentText, this.document.languageId, { onComment: comments });
        const sections = this.getConfigSections(body);

        if (sections === null) {
            return null;
        }

        // TODO: Plugins, too

        const rulesContainers = sections.map(section => {
            const { rules } = getContainers(section);
            return rules;
        }).flat();

        // Find active container
        // TODO: search other containers as well (plugins, etc.)
        let activeContainer = null;
        for (const container of rulesContainers) {
            const start = container.start;
            const end = container.end;

            if (offset >= start && offset <= end) {
                activeContainer = container;
                break;
            }
        }

        // If offset is not in any container, then return Other
        if (activeContainer === null) {
            // TODO: this fails with an error: baseVisitor[type] does not exist
            // const node = walk.findNodeAround(body, offset);
            // return getRange(node, EntryType.Other);
            return {
                type: EntryType.Other
            };
        }


        // If offset is within a comment, return Comment
        for (const comment of comments) {
            const start = comment.start;
            const end = comment.end;

            if (offset >= start && offset <= end) {
                const range = getRange(comment, EntryType.Comment);
                range.commentType = comment.type;
                return range;
            }
        }

        // offset is within a container (but where?)

        for (const prop of activeContainer.properties) {
            const start = prop.start;
            const end = prop.end;

            // offset is not within this property
            if (start > offset || end < offset) {
                continue;
            }

            if (prop.type !== 'Property') {
                return getRange(prop, EntryType.Pointer);
            }

            // Is offset in the key or value?

            if (prop.key &&
                prop.key.type === 'Identifier' &&
                prop.start === prop.key.start &&
                prop.end === prop.key.end
            ) {
                return getRange(prop, EntryType.Pointer);
            }

            if (prop.key &&
                prop.key.start <= offset &&
                prop.key.end >= offset
            ) {
                return getRange(prop.key, EntryType.RuleKey);
            }

            // TODO: FIX acorn-loose no prop value issue
            // acorn-loose issue:  when there is no comma, prop.value depends on what the NEXT property (if any) is
            if (isDummy(prop.value) || prop.key.loc.end.line !== prop.value.loc.start.line) {
                const range = new Range(position, position);
                range.type = EntryType.EmptyRuleValue;
                return range;
            }

            // TODO: where in the value? (severity? options?)
            //      need to do some other things to determine this (steal from getRuleDetails?)
            return getRange(prop.value, EntryType.RuleValue);
        }

        return getRange(activeContainer, EntryType.RulesContainer);
    }
};
