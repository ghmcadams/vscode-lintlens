import { Range } from 'vscode';
import { load } from 'yaml-ast-parser';
import Parser, { EntryType } from './Parser';


function getASTBody(document) {
    const documentText = document.getText();
    return load(documentText);
}

function getSections(body) {
    const sections = [body];

    for (const prop of body.mappings) {
        if (prop.key.value === 'overrides') {
            sections.push(...prop.value.items);
        }
    }

    return sections;
}

function getContainers(section) {
    if (!section?.mappings?.length) {
        return {};
    }

    const containers = {};

    for (const prop of section.mappings) {
        if (prop.key.value === 'rules') {
            containers.rules = [prop.value];
        }
        if (prop.key.value === 'plugins') {
            containers.plugins = [prop.value];
        }
    }

    return containers;
}

function getRange(document, statement) {
    const startPosition = document.positionAt(statement.startPosition - 1);
    const endPosition = document.positionAt(statement.endPosition - 1);

    return document.validateRange(new Range(startPosition, endPosition));
}

function getPlugins(document, container) {
    return container.items.map(plugin => getPluginDetails(document, plugin));
}

function getPluginDetails(document, plugin) {
    const range = getRange(document, plugin);

    return {
        type: EntryType.Plugin,
        name: plugin.value,
        range
    };
}

function getRules(document, container) {
    return container.mappings.map(rule => getRuleDetails(document, rule));
}

function getRuleDetails(document, rule) {
    const range = getRange(document, rule);
    const keyRange = getRange(document, rule.key);

    return {
        type: EntryType.Rule,
        name: rule.key.value,
        range,
        key: {
            range: keyRange
        },
        // configuration: {
        //     severityRange,
        //     optionsRange,
        //     value: optionsConfig
        // }
    };
}

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const body = getASTBody(this.document);
        if (!body) {
            return null;
        }

        // get sections (main, overrides)
        const sections = getSections(body);

        return sections.map(section => {
            const {
                // (main.plugins, overrides[x].plugins)
                plugins: pluginsContainers = [],
                // (main.rules, overrides[x].rules)
                rules: rulesContainers = []
            } = getContainers(section);

            const pluginsValue = pluginsContainers.map(container => {
                return {
                    range: getRange(this.document, container),
                    entries: getPlugins(this.document, container)
                };
            });

            const rulesValue = rulesContainers.map(container => {
                return {
                    range: getRange(this.document, container),
                    entries: getRules(this.document, container)
                };
            });

            return {
                plugins: pluginsValue,
                rules: rulesValue
            };
        });
    }

    getActiveRange(position) {
        // TODO: Implement getActiveRange(position) in YAMLParser
        return null;
    }
};
