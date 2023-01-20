import { commands, languages } from 'vscode';
import { initialize as initializeWebViewController, openInVSCode, openInBrowser } from './controllers/webViewController';
import { initialize as initializeLineAnnotationsController } from './controllers/lineAnnotationsController';
import { initialize as initializeCodeModController, replaceRange } from './controllers/codeModController';
import { initialize as initializeInlineCompletionController, provider as inlineCompletionController } from './controllers/inlineCompletionController';
import { initialize as initializeRuleCompletionController, provider as ruleCompletionController } from './controllers/ruleCompletionController';
import { commands as commandConstants } from './constants';

export function activate(context) {
    initializeLineAnnotationsController(context);
    initializeCodeModController(context);
    initializeWebViewController(context);
    initializeInlineCompletionController(context);
    initializeRuleCompletionController(context);

    context.subscriptions.push(commands.registerCommand(commandConstants.openWebViewPanel, openInVSCode));
    context.subscriptions.push(commands.registerCommand(commandConstants.openInBrowser, openInBrowser));
    context.subscriptions.push(commands.registerTextEditorCommand(commandConstants.replaceText, replaceRange));

    const documentSelectors = [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' },
        { language: 'json', scheme: 'file' },
        { language: 'jsonc', scheme: 'file' }
    ];

    documentSelectors.forEach(selector => {
        context.subscriptions.push(languages.registerInlineCompletionItemProvider(selector, inlineCompletionController));
        context.subscriptions.push(languages.registerCompletionItemProvider(selector, ruleCompletionController, "'", "`", "\"", "\n"));
    });
}

export function deactivate() {
};
