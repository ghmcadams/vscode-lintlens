import { Position, Range } from 'vscode';
import { parseExpressionAt } from 'acorn';
import { jsonrepair } from 'jsonrepair';
import Parser from './Parser';


function getRange(document, statement) {
    if (!statement) {
        return null;
    }

    const keyStartPosition = new Position(statement.loc.start.line - 1, statement.loc.start.column);
    const keyEndPosition = new Position(statement.loc.end.line - 1, statement.loc.end.column);

    return document.validateRange(new Range(keyStartPosition, keyEndPosition));
}

export default class JSONParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const rules = [];
        const documentText = this.document.getText();
        const ast = parseExpressionAt(documentText, 0, { locations: true, ecmaVersion: 2020 });

        ast.properties.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.properties.forEach(rule => {
                    const keyRange = getRange(this.document, rule.key);
                    const severityRange = rule.value.type === 'ArrayExpression' ? getRange(this.document, rule.value.elements[0]) : getRange(this.document, rule.value);
                    const optionsRange = rule.value.type === 'ArrayExpression' && getRange(this.document, rule.value.elements[1]);

                    const optionsConfig = JSON.parse(jsonrepair(documentText.slice(rule.value.start, rule.value.end)));

                    const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                    rules.push({
                        name: rule.key.value,
                        keyRange,
                        severityRange,
                        optionsRange,
                        optionsConfig,
                        lineEndingRange
                    });
                });
            } else if (prop.key.value === 'overrides') {
                prop.value.elements.forEach(override => {
                    override.properties.forEach(overrideProp => {
                        if (overrideProp.key.value === 'rules') {
                            overrideProp.value.properties.forEach(rule => {
                                const keyRange = getRange(this.document, rule.key);
                                const severityRange = rule.value.type === 'ArrayExpression' ? getRange(this.document, rule.value.elements[0]) : getRange(this.document, rule.value);
                                const optionsRange = rule.value.type === 'ArrayExpression' && getRange(this.document, rule.value.elements[1]);
            
                                const optionsConfig = JSON.parse(jsonrepair(documentText.slice(rule.value.start, rule.value.end)));

                                const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));
            
                                rules.push({
                                    name: rule.key.value,
                                    keyRange,
                                    severityRange,
                                    optionsRange,
                                    optionsConfig,
                                    lineEndingRange
                                });
                            });
                        }
                    });
                });
            }
        });

        return rules;
    }
};
