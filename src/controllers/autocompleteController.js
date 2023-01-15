import { Range } from 'vscode';
import { getAllRuleIds } from '../rules';


let extensionContext;

export function initialize(context) {
    extensionContext = context;
}

export const provider = {
    provideInlineCompletionItems: async (document, position, context, cancelToken) => {
        // Check that this is an ESLINT configuration file
        const eslintConfigFiles = extensionContext?.workspaceState.get('eslintConfigFiles') ?? [];
        if (!eslintConfigFiles.includes(document.fileName)) {
            return;
        }

        // Determine if user is typing a new object key (assume ESLint rule)
        const regexp = /(?<=[{,])\s*?(?<quote>[\"\'\`]?)(?<ruleId>@?[a-zA-Z]+\/?[a-zA-Z]*-?[a-zA-Z]*)$/;
        const beginningToCursor = new Range(0, 0, position.line, position.character);
        const textSoFar = document.getText(beginningToCursor);
        const matches = textSoFar.match(regexp);
        if (matches) {
            const { quote = '', ruleId } = matches.groups;
            const startIndex = position.character - ruleId.length - quote.length;
            const endIndex = position.character + quote.length;
            const range = new Range(position.line, startIndex, position.line, endIndex);

            const allRules = getAllRuleIds(document.fileName)
                .map(rule => (`${quote}${rule}${quote}: `));

            return allRules.map(insertText => ({
                insertText,
                range
            }));
        }
    },
};
