const vscode = require('vscode');
const webViewController = require('./controllers/webViewController');
const lineAnnotationsController = require('./controllers/lineAnnotationsController');
const codeModController = require('./controllers/codeModController');
const constants = require('./constants');

exports.activate = function activate(context) {
    lineAnnotationsController.initialize(context);
    codeModController.initialize(context);
    webViewController.initialize(context);

    context.subscriptions.push(vscode.commands.registerCommand(constants.commands.openWebViewPanel, webViewController.openInVSCode));
    context.subscriptions.push(vscode.commands.registerCommand(constants.commands.openInBrowser, webViewController.openInBrowser));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(constants.commands.replaceText, codeModController.replaceRange));
}

exports.deactivate = function deactivate() {
};
