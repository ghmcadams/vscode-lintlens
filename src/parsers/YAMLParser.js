import { Range } from 'vscode';
import { load } from 'yaml-ast-parser';
import Parser from './Parser';

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        const rules = [];
        const documentText = this.document.getText();
        const ast = load(documentText);

        ast.mappings.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.mappings.forEach(rule => {
                    const keyStartPosition = this.document.positionAt(rule.key.startPosition - 1);
                    const keyEndPosition = this.document.positionAt(rule.key.endPosition - 1);
                    const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));

                    const lineEndingRange = this.document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));

                    rules.push({
                        name: rule.key.value,
                        keyRange,
                        lineEndingRange
                    });
                });
            } else if (prop.key.value === 'overrides') {
                prop.value.items.forEach(override => {
                    override.mappings.forEach(overrideProp => {
                        if (overrideProp.key.value === 'rules') {
                            overrideProp.value.mappings.forEach(rule => {
                                const keyStartPosition = this.document.positionAt(rule.startPosition - 1);
                                const keyEndPosition = this.document.positionAt(rule.endPosition - 1);
                                const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
                                const lineEndingRange = this.document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));

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
