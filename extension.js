const vscode = require('vscode');
const webViewController = require('./controllers/webViewController');
const lineAnnotationsController = require('./controllers/lineAnnotationsController');
const codeModController = require('./controllers/codeModController');
const constants = require('./constants');

exports.activate = function activate(context) {
    lineAnnotationsController.initialize(context);
    codeModController.initialize(context);
    webViewController.initialize(context);

    context.subscriptions.push(vscode.commands.registerCommand(constants.openWebViewPanelCommand, webViewController.openInVSCode));
    context.subscriptions.push(vscode.commands.registerCommand(constants.openInBrowserCommand, webViewController.openInBrowser));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(constants.replaceTextCommand, codeModController.replaceRange));
}

exports.deactivate = function deactivate() {
};
