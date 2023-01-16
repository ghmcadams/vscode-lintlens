import { Range } from 'vscode';
import { load } from 'yaml-ast-parser';
import Parser from './Parser';


function getRules(body) {
    try {
        const rules = [];

        for (const prop of body.mappings) {
            if (prop.key.value === 'rules') {
                rules.push(...prop.value.mappings);
            } else if (prop.key.value === 'overrides') {
                prop.value.items.forEach(override => {
                    override.mappings.forEach(overrideProp => {
                        if (overrideProp.key.value === 'rules') {
                            rules.push(...overrideProp.value.mappings);
                        }
                    });
                });
            }
        }

        return rules;
    } catch(err) {
        return [];
    }
}

export default class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        try {
            const documentText = this.document.getText();
            const ast = load(documentText);
    
            const configuredRules = getRules(ast);
    
            return configuredRules.map(rule => {
                const keyStartPosition = this.document.positionAt(rule.key.startPosition - 1);
                const keyEndPosition = this.document.positionAt(rule.key.endPosition - 1);
                const keyRange = this.document.validateRange(new Range(keyStartPosition, keyEndPosition));
    
                const lineEndingRange = this.document.validateRange(new Range(keyStartPosition.line, Number.MAX_SAFE_INTEGER, keyStartPosition.line, Number.MAX_SAFE_INTEGER));
    
                return {
                    name: rule.key.value,
                    keyRange,
                    lineEndingRange
                };
            });
        } catch (err) {
            return [];
        }
    }
};
