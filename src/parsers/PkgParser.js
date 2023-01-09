import { Position, Range } from 'vscode';
import { parseExpressionAt } from 'acorn';
import { jsonrepair } from 'jsonrepair';
import Parser from './Parser';

export default class PkgParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const rules = [];
        const documentText = this.document.getText();
        const ast = parseExpressionAt(documentText, 0, { locations: true, ecmaVersion: 2020 });

        ast.properties.forEach(prop => {
            if (prop.key.value === 'eslintConfig') {
                prop.value.properties.forEach(cfg => {
                    if (cfg.key.value === 'rules') {
                        cfg.value.properties.forEach(rule => {
                            const keyStartPosition = new Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                            const keyEndPosition = new Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                            const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));

                            const valueStartPosition = new Position(rule.value.loc.start.line - 1, rule.value.loc.start.column);
                            const valueEndPosition = new Position(rule.value.loc.end.line - 1, rule.value.loc.end.column);
                            const valueRange = this.document.validateRange(new Range(valueStartPosition, valueEndPosition));
                            const value = JSON.parse(jsonrepair(documentText.slice(rule.value.start, rule.value.end)));

                            const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                            rules.push({
                                name: rule.key.value,
                                keyRange,
                                valueRange,
                                value,
                                lineEndingRange
                            });
                        });
                    } else if (cfg.key.value === 'overrides') {
                        cfg.value.elements.forEach(override => {
                            override.properties.forEach(overrideProp => {
                                if (overrideProp.key.value === 'rules') {
                                    overrideProp.value.properties.forEach(rule => {
                                        const keyStartPosition = new Position(rule.key.loc.start.line - 1, rule.key.loc.start.column);
                                        const keyEndPosition = new Position(rule.key.loc.end.line - 1, rule.key.loc.end.column);
                                        const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));

                                        const valueStartPosition = new Position(rule.value.loc.start.line - 1, rule.value.loc.start.column);
                                        const valueEndPosition = new Position(rule.value.loc.end.line - 1, rule.value.loc.end.column);
                                        const valueRange = this.document.validateRange(new Range(valueStartPosition, valueEndPosition));
                                        const value = JSON.parse(jsonrepair(documentText.slice(rule.value.start, rule.value.end)));

                                        const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));

                                        rules.push({
                                            name: rule.key.value,
                                            keyRange,
                                            valueRange,
                                            value,
                                            lineEndingRange
                                        });
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
    
        return rules;
    }
};
