const AcornParser = require('./AcornParser');

module.exports = class PkgParser extends AcornParser {
    constructor(document) {
        super(document);
    }

    get rules() {
        return this.mapChildren(this.ast, 'eslintConfig', value => this.getAllRules(value));
    }
};
