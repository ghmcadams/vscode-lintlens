const vscode = require('vscode');
const open = require('open');
const JSCodeLensProvider = require('./codeLensProvider/javascript');
const JSONCodeLensProvider = require('./codeLensProvider/json');
const PkgCodeLensProvider = require('./codeLensProvider/pkg');
const YAMLCodeLensProvider = require('./codeLensProvider/yaml');
const eslintManager = require('./eslintManager');

exports.activate = function activate(context) {
    eslintManager.getESLint().then((eslint) => {
        if (eslint) {
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc.js', scheme: 'file' }, new JSCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc.json', scheme: 'file' }, new JSONCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc.yaml', scheme: 'file' }, new YAMLCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc.yml', scheme: 'file' }, new YAMLCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc', scheme: 'file', language: 'json' }, new JSONCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/.eslintrc', scheme: 'file', language: 'yaml' }, new YAMLCodeLensProvider()));
            context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/package.json', scheme: 'file' }, new PkgCodeLensProvider()));
        
            context.subscriptions.push(vscode.commands.registerCommand('extension.openEslintRule', function openEslintRule(url) {
                open(url);
            }));
        } else {
            vscode.window.showWarningMessage('eslint must be installed for this extension to work.');
        }
    });
}

exports.deactivate = function deactivate() {
};
