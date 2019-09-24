import { Range } from 'vscode';
import { load } from 'yaml-ast-parser';
import Parser from './Parser';

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        let rules = [];
        let ast = load(this.document.getText());

        ast.mappings.forEach(prop => {
            if (prop.key.value === 'rules') {
                prop.value.mappings.forEach(rule => {
                    let keyStartPosition = this.document.positionAt(rule.startPosition - 1);
                    let keyEndPosition = this.document.positionAt(rule.endPosition - 1);
                    let keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
                    let lineEndingRange = this.document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));
    
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
                                let keyStartPosition = this.document.positionAt(rule.startPosition - 1);
                                let keyEndPosition = this.document.positionAt(rule.endPosition - 1);
                                let keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
                                let lineEndingRange = this.document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));
                
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
