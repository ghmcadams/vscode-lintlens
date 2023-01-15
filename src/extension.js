import { commands, languages } from 'vscode';
import { initialize as initializeWebViewController, openInVSCode, openInBrowser } from './controllers/webViewController';
import { initialize as initializeLineAnnotationsController } from './controllers/lineAnnotationsController';
import { initialize as initializeCodeModController, replaceRange } from './controllers/codeModController';
import { initialize as initializeAutocompleteController, provider as autocompleteProvider } from './controllers/autocompleteController';
import { commands as commandConstants } from './constants';

export function activate(context) {
    initializeLineAnnotationsController(context);
    initializeCodeModController(context);
    initializeWebViewController(context);
    initializeAutocompleteController(context);

    context.subscriptions.push(commands.registerCommand(commandConstants.openWebViewPanel, openInVSCode));
    context.subscriptions.push(commands.registerCommand(commandConstants.openInBrowser, openInBrowser));
    context.subscriptions.push(commands.registerTextEditorCommand(commandConstants.replaceText, replaceRange));

    languages.registerInlineCompletionItemProvider({ language: 'javascript', scheme: 'file' }, autocompleteProvider);
    languages.registerInlineCompletionItemProvider({ language: 'javascriptreact', scheme: 'file' }, autocompleteProvider);
    languages.registerInlineCompletionItemProvider({ language: 'json', scheme: 'file' }, autocompleteProvider);
    languages.registerInlineCompletionItemProvider({ language: 'jsonc', scheme: 'file' }, autocompleteProvider);
}

export function deactivate() {
};
