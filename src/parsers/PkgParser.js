import { Position, Range } from 'vscode';
import { parseExpressionAt } from 'acorn';
import { jsonrepair } from 'jsonrepair';
import Parser from './Parser';


function getRules(body) {
    try {
        const rules = [];

        for (const prop of body.properties) {
            if (prop.key.value === 'eslintConfig') {
                prop.value.properties.forEach(cfg => {
                    if (cfg.key.value === 'rules') {
                        rules.push(...cfg.value.properties);
                    } else if (cfg.key.value === 'overrides') {
                        cfg.value.elements.forEach(override => {
                            override.properties.forEach(overrideProp => {
                                if (overrideProp.key.value === 'rules') {
                                    rules.push(...overrideProp.value.properties);
                                }
                            });
                        });
                    }
                });
            }
        }

        return rules;
    } catch(err) {
        return [];
    }
}

function getRange(document, statement) {
    if (!statement || (Array.isArray(statement) && statement.length === 0)) {
        return null;
    }

    const statements = Array.isArray(statement) ? statement : [statement];

    const startPosition = new Position(statements.at(0).loc.start.line - 1, statements.at(0).loc.start.column);
    const endPosition = new Position(statements.at(-1).loc.end.line - 1, statements.at(-1).loc.end.column);

    return document.validateRange(new Range(startPosition, endPosition));
}

export default class PkgParser extends Parser {
    constructor(document) {
        super(document);
    }

    parse() {
        try {
            const documentText = this.document.getText();
            const ast = parseExpressionAt(documentText, 0, { locations: true, ecmaVersion: 2020 });
    
            const configuredRules = getRules(ast);
    
            return configuredRules.map(rule => {
                const keyRange = getRange(this.document, rule.key);
    
                let severityRange, optionsRange;
                if (rule.value.type === 'ArrayExpression') {
                    severityRange = getRange(this.document, rule.value.elements[0]);
                    optionsRange = getRange(this.document, rule.value.elements.slice(1));
                } else if (rule.value.type === 'Literal') {
                    severityRange = getRange(this.document, rule.value);
                }
                const optionsConfig = JSON.parse(jsonrepair(documentText.slice(rule.value.start, rule.value.end)));
    
                const lineEndingRange = this.document.validateRange(new Range(rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER, rule.key.loc.start.line - 1, Number.MAX_SAFE_INTEGER));
    
                return {
                    name: rule.key.value,
                    keyRange,
                    severityRange,
                    optionsRange,
                    optionsConfig,
                    lineEndingRange
                };
            });
        } catch (err) {
            return [];
        }
    }
};
