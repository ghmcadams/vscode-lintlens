import { Range, CompletionItem, CompletionItemKind } from 'vscode';
import { getAllRuleIds } from '../rules';


let extensionContext;

export function initialize(context) {
    extensionContext = context;
}

export const provider = {
    provideCompletionItems: (document, position, cancelToken, context) => {
        // Check that this is an ESLINT configuration file
        const eslintConfigFiles = extensionContext?.workspaceState.get('eslintConfigFiles') ?? [];
        if (!eslintConfigFiles.includes(document.fileName)) {
            return;
        }

        // TODO: only do it if its in the right place
        //      only in rules object
        //      not the value section

        // Determine if user is typing a new object key (assume ESLint rule)
        const regexp = /(?<=[{,])\s*?(?<openQuote>[\"\'\`]?)(?<ruleId>@?[\w-]*\/?[\w-]*(-?[\w-])*)$/;
        const beginningToCursor = new Range(0, 0, position.line, position.character);
        const textSoFar = document.getText(beginningToCursor);

        const matches = textSoFar.match(regexp);
        if (matches) {
            const {
                openQuote,
                ruleId
            } = matches.groups;

            const startIndex = position.character - ruleId.length - openQuote.length;
            const endIndex = position.character + openQuote.length;
            const range = new Range(position.line, startIndex, position.line, endIndex);

            const allRules = getAllRuleIds(document.fileName)
                .map(rule => (`${openQuote}${rule}${openQuote}: `));

            return allRules.map(insertText => {
                const item = new CompletionItem(insertText, CompletionItemKind.Property);
                item.range = range;

                return item;
            });
        }
    }
};
