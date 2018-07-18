const vscode = require('vscode');
const eslintManager = require('./eslintManager');

const recommendedIcon = '\u2605';
const warningFoundIcon = '\u2757';


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
        if (this.plugin && !eslintManager.isPluginImported(this.plugin)) {
            importer = eslintManager.importPlugin(this.plugin);
        }

        return importer
            .then(() => {
                if (eslintManager.hasRule(this.rule.name)) {
                    let ruleData = eslintManager.getRuleData(this.rule.name);

                    let title = '';
                    if (ruleData.recommended === true) {
                        title += `${recommendedIcon}  `;
                    }

                    if (ruleData.category) {
                        title += `[${ruleData.category}]:  `;
                    }

                    if (ruleData.description) {
                        title += ruleData.description;
                    } else {
                        title += `eslint rule: ${this.rule.name}`;
                    }

                    if (ruleData.url) {
                        this.command = {
                            title,
                            command: 'extension.openEslintRule',
                            arguments: [ ruleData.url ]
                        };
                    } else {
                        this.command = {
                            title
                        };
                    }
                } else {
                    this.command = {
                        title: `${warningFoundIcon}Rule not found`,
                        command: 'extension.openEslintRule',
                        arguments: [ (this.plugin ? `${eslintManager.npmPackageBaseUrl}${eslintManager.eslintPluginPrefix}${this.plugin}` : eslintManager.eslintRulesUrl) ]
                    };
                }
            }, err => {
                if (err.name === 'MissingPluginError') {
                    this.command = {
                        title: `${warningFoundIcon}Missing: ${eslintManager.eslintPluginPrefix}${err.plugin}`,
                        command: 'extension.openEslintRule',
                        arguments: [ `${eslintManager.npmPackageBaseUrl}${eslintManager.eslintPluginPrefix}${err.plugin}` ]
                    };
                }
            });
    }
}
