const vscode = require('vscode');
const RuleLens = require('./ruleLens');

module.exports = class ESLintRuleCodeLensProvider {
    constructor(parser) {
        this.parser = parser;
    }

    provideCodeLenses(document) {
        let codeLenses = [];
        let rules = this.parser(document);

        rules.forEach(rule => {
            codeLenses.push(new RuleLens(rule));
        });

        return codeLenses;

    }

    resolveCodeLens(codeLens) {
        if (codeLens instanceof RuleLens) {
            return codeLens.buildCommand().then(() => {
                return codeLens;
            });
        }
        return codeLens;
    }
}
