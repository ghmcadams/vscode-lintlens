import { Position, Range } from 'vscode';
import { parseExpressionAt } from 'acorn';
import Parser from './Parser';

export default class JSONParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let rules = [];
        let ast = parseExpressionAt(this.document.getText(), 0, { locations: true });

        ast.properties.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.properties.forEach(rule => {
                    let keyStartPosition = new Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                    let keyEndPosition = new Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                    let keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
                    let lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                    rules.push({
                        name: rule.key.value,
                        keyRange,
                        lineEndingRange
                    });
                });
            } else if (prop.key.value === 'overrides') {
                prop.value.elements.forEach(override => {
                    override.properties.forEach(overrideProp => {
                        if (overrideProp.key.value === 'rules') {
                            overrideProp.value.properties.forEach(rule => {
                                let keyStartPosition = new Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                                let keyEndPosition = new Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                                let keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
                                let lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));
            
                                rules.push({
                                    name: rule.key.value,
                                    keyRange,
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
