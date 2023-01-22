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

function getRulesContainers(section) {
    for (const prop of section.mappings) {
        if (prop.key.value === 'rules') {
            return [prop.value];
        }
    }

    return [];
}

function getRange(document, statement) {
    const startPosition = document.positionAt(statement.startPosition - 1);
    const endPosition = document.positionAt(statement.endPosition - 1);

    return document.validateRange(new Range(startPosition, endPosition));
}

function getRules(document, container) {
    return container.mappings.map(rule => getRuleDetails(document, rule));
}

function getRuleDetails(document, rule) {
    const range = getRange(document, rule);
    const keyRange = getRange(document, rule.key);

    const ruleLine = document.positionAt(rule.startPosition - 1).line;
    const lineEndingRange = document.validateRange(new Range(ruleLine, Number.MAX_SAFE_INTEGER, ruleLine, Number.MAX_SAFE_INTEGER));

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
        // },
        lineEndingRange
    };
}

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const body = getASTBody(this.document);

        // get sections (main, overrides)
        const sections = getSections(body);

        return sections.map(section => {
            // TODO: Plugins and Extends

            // get rules containers (main.rules, overrides[x].rules)
            const rulesContainers = getRulesContainers(section);

            const rulesValue = rulesContainers.map(container => {
                return {
                    range: getRange(this.document, container),
                    entries: getRules(this.document, container)
                };
            });

            return {
                rules: rulesValue
            };
        });
    }
};
