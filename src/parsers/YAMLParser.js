import { Range } from 'vscode';
import { load } from 'yaml-ast-parser';
import Parser from './Parser';


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

function getRules(document, containers) {
    return containers
        .flatMap(container => container.mappings)
        .map(rule => getRuleDetails(document, rule));
}

function getRuleDetails(document, rule) {
    const keyStartPosition = document.positionAt(rule.key.startPosition - 1);
    const keyEndPosition = document.positionAt(rule.key.endPosition - 1);
    const keyRange = document.validateRange(new Range(keyStartPosition, keyEndPosition));
    const lineEndingRange = document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));

    return {
        name: rule.key.value,
        keyRange,
        lineEndingRange
    };
}

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse({
        containersOnly = false
    } = {}) {
        const body = getASTBody(this.document);

        // get sections (main, overrides)
        const sections = getSections(body);

        return sections.map(section => {
            // get rules containers (main.rules, overrides[x].rules)
            const rulesContainers = getRulesContainers(section);

            const rulesValue = {
                containers: rulesContainers.map(container => getRange(this.document, container)),
                entries: null
            };

            if (containersOnly !== true) {
                rulesValue.entries = getRules(this.document, rulesContainers);
            }

            return {
                // extends: extendsValue,
                // plugins: pluginsValue,
                rules: rulesValue
            };

        });
    }
};
