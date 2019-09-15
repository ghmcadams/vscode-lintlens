import { commands } from 'vscode';
import { initialize as initializeWebViewController, openInVSCode, openInBrowser } from './controllers/webViewController';
import { initialize as initializeLineAnnotationsController } from './controllers/lineAnnotationsController';
import { initialize as initializeCodeModController, replaceRange } from './controllers/codeModController';
import { commands as commandConstants } from './constants';

export function activate(context) {
    initializeLineAnnotationsController(context);
    initializeCodeModController(context);
    initializeWebViewController(context);

    context.subscriptions.push(commands.registerCommand(commandConstants.openWebViewPanel, openInVSCode));
    context.subscriptions.push(commands.registerCommand(commandConstants.openInBrowser, openInBrowser));
    context.subscriptions.push(commands.registerTextEditorCommand(commandConstants.replaceText, replaceRange));
}

export function deactivate() {
};
