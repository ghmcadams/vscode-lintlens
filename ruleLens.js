const vscode = require('vscode');
const eslintManager = require('./eslintManager');

const recommendedIcon = '\u2605';
const warningIcon = '\u2757';
const MISSING_URL_URL = 'https://github.com/ghmcadams/vscode-lintlens/wiki/Missing-Rule-Docs-URL';

function getCommand(lensText, url, pageTitle) {
    return {
        title: lensText,
        command: 'lintlens.openWebView',
        arguments: [ {url, pageTitle} ]
    };
}

module.exports = class RuleLens extends vscode.CodeLens {
    constructor(rule) {
        super(rule.keyRange);

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

        let pluginPackageName = `${eslintManager.eslintPluginPrefix}${this.plugin}`;
        const pluginUrl = `${eslintManager.npmPackageBaseUrl}${pluginPackageName}`;

        return importer
            .then(() => {
                let ruleInfo = eslintManager.getRule(this.rule.name);

                if (!ruleInfo) {
                    this.command = getCommand(
                        'Rule not found',
                        (this.plugin ? pluginUrl : eslintManager.eslintRulesUrl),
                        `${(this.plugin ? pluginPackageName : 'eslint rules')} - LintLens`
                    );
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

                    this.command = getCommand(
                        title,
                        ruleDocs.url || (this.plugin ? MISSING_URL_URL : eslintManager.eslintRulesUrl),
                        `${this.rule.name} - LintLens`
                    );
                }
            }, err => {
                if (err.name === 'MissingPluginError') {
                    this.command = getCommand(
                        `${warningIcon}Missing: ${pluginPackageName}`,
                        pluginUrl,
                        `${pluginPackageName} - LintLens`
                    );
                }
            });
    }
}
