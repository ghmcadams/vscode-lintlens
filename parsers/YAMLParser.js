const yaml = require('yaml-ast-parser');
const Parser = require('./Parser');

module.exports = class YAMLParser extends Parser {
    constructor(document) {
        super(document);
    }

    get ast() {
        return yaml.load(this.document.getText());
    }

    getProps(node) {
        return node.mappings;
    }

    getItems(node) {
        return node.items;
    }

    getRuleLocation(rule) {
        return [
            this.document.positionAt(rule.startPosition - 1),
            this.document.positionAt(rule.endPosition - 1),
        ];
    }
};
