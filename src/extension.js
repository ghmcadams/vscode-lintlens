import { initialize as initializeWebViewController } from './controllers/webViewController';
import { initialize as initializeLineAnnotationsController } from './controllers/lineAnnotationsController';
import { initialize as initializeCodeModController } from './controllers/codeModController';
import { initialize as initializeInlineCompletionController } from './controllers/inlineCompletionController';
import { initialize as initializeRuleCompletionController } from './controllers/ruleCompletionController';


export function activate(context) {
    initializeLineAnnotationsController(context);
    initializeCodeModController(context);
    initializeWebViewController(context);
    initializeInlineCompletionController(context);
    initializeRuleCompletionController(context);
}

export function deactivate() {
};
