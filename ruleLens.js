const vscode = require('vscode');
const eslintManager = require('./eslintManager');

const recommendedIcon = '\u2605';
const warningIcon = '\u2757';
const MISSING_URL_URL = 'https://github.com/ghmcadams/vscode-lintlens/wiki/Missing-Rule-Docs-URL';

module.exports = class RuleLens extends vscode.CodeLens {
    constructor(rule) {
        super(new vscode.Range(rule.start, rule.end));

        this.rule = rule;

        let ruleNameParts = rule.name.split('/');
        if (ruleNameParts.length > 1) {
            this.plugin = ruleNameParts[0];
        }
    }

    buildCommand() {
        let importer = Promise.resolve();

        // If the rule is a plugin rule, import plugin first
        if (this.plugin) {
            importer = eslintManager.importPlugin(this.plugin);
        }

        return importer
            .then(() => {
                let ruleInfo = eslintManager.getRule(this.rule.name);

                if (!ruleInfo) {
                    this.command = {
                        title: `${warningIcon}Rule not found`,
                        command: 'extension.openEslintRule',
                        arguments: [ (this.plugin ? `${eslintManager.npmPackageBaseUrl}${eslintManager.eslintPluginPrefix}${this.plugin}` : eslintManager.eslintRulesUrl) ]
                    };
                } else {
                    let ruleDocs = (ruleInfo.meta && ruleInfo.meta.docs) ? ruleInfo.meta.docs : {};

                    let title = '';
                    if (ruleDocs.recommended === true) {
                        title += `${recommendedIcon}  `;
                    }

                    if (ruleDocs.category) {
                        title += `[${ruleDocs.category}]:  `;
                    }

                    if (ruleDocs.description) {
                        title += ruleDocs.description;
                    } else {
                        title += `eslint rule: ${this.rule.name}`;
                    }

                    this.command = {
                        title,
                        command: 'extension.openEslintRule',
                        arguments: [ ruleDocs.url || (this.plugin ? MISSING_URL_URL : eslintManager.eslintRulesUrl) ]
                    };
                }
            }, err => {
                if (err.name === 'MissingPluginError') {
                    this.command = {
                        title: `${warningIcon}Missing: ${eslintManager.eslintPluginPrefix}${err.plugin}`,
                        command: 'extension.openEslintRule',
                        arguments: [ `${eslintManager.npmPackageBaseUrl}${eslintManager.eslintPluginPrefix}${err.plugin}` ]
                    };
                }
            });
    }
}
