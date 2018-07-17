const RuleLens = require('../ruleLens');

module.exports = class ESLintRuleCodeLensProvider {
    getRules() {
        return [];
    }

    provideCodeLenses(document) {
        let codeLenses = [];
        let rules = this.getRules(document);

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
