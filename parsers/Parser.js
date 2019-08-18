const vscode = require('vscode');

module.exports = class Parser {
    constructor(document) {
        if (new.target === Parser) {
            throw new Error('Parser cannot be instantiated directly.');
        }

        this.document = document;
    }

    getRules() {
        const rules = this.rules;

        return rules && rules.length ? this.flagDuplicates(rules) : [];
    }

    get rules() {
        // This default implementation fits for for YAML and JSON parsers.
        // JS & Package parsers override it.
        return this.getAllRules(this.ast);
    }

    get ast() {
        throw new Error('ast getter must be implemented in the child class.');
    }

    getNodeKey(node) {
        // This default implementation fits for YAML, JSON, and Package parsers.
        // JS parser overrides it.
        return node.key.value;
    }

    /** Gets properties of an object-like AST node. */
    getProps(node) {
        throw new Error('getProps method must be implemented in the child class.');
    }

    /** Gets elements of an array-like AST node. */
    getItems(node) {
        throw new Error('getItems method must be implemented in the child class.');
    }

    /** Flatmaps `callback` over `node`'s child property (or children properties) named `key`. */
    mapChildren(node, key, callback) {
        return this.getProps(node)
            .filter(prop => this.getNodeKey(prop) === key)
            .flatMap(prop => callback(prop.value));
    }

    /** Gets both plain and overridden rules from `node`. */
    getAllRules(node) {
        const mainRules = this.getRulesFromNode(node);
        const overrideRules = this.getOverridesFromNode(node);

        return mainRules.concat(overrideRules);
    }

    /** Gets rules from AST node, assuming this node has 'rules' child. */
    getRulesFromNode(node) {
        return this.mapChildren(node, 'rules', value =>
            this.getProps(value).map(rule => this.getRule(rule)),
        );
    }

    /** Gets rules from AST node, assuming this node has 'overrides' child. */
    getOverridesFromNode(node) {
        return this.mapChildren(node, 'overrides', value =>
            this.getItems(value).flatMap(item => this.getRulesFromNode(item)),
        );
    }

    /** Gets start and end positions of the rule location in the document. */
    getRuleLocation(rule) {
        throw new Error('getRuleLocation method must be implemented in the child class.');
    }

    getRule(rule) {
        const [start, end] = this.getRuleLocation(rule);

        const name = this.getNodeKey(rule);
        const keyRange = this.document.validateRange(new vscode.Range(start, end));
        const eol = new vscode.Position(keyRange.start.line, Number.MAX_SAFE_INTEGER);
        const eolRange = this.document.validateRange(new vscode.Range(eol, eol));

        return { name, keyRange, eolRange };
    }

    flagDuplicates(rules) {
        const ruleNames = rules.map(rule => rule.name);

        rules.forEach((rule, index) => {
            if (rule.duplicate) {
                return;
            }
            const otherIndex = ruleNames.indexOf(rule.name, index + 1);
            if (~otherIndex) {
                rules[index].duplicate = true;
                rules[otherIndex].duplicate = true;
            }
        });

        return rules;
    }
};
