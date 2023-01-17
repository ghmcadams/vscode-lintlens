import { Range, InlineCompletionItem, CompletionItemKind, SnippetString } from 'vscode';


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

        // Determine if user is typing after an object key (assume ESLint rule)
        const regexp = /(?<=[{,])(?<!:\s*\[.+,\s*\{)\s*?(?<q>[\"\'\`]?)@?[\/\w-]+\k<q>?(?<sep>[^\S\r\n]*:[^\S\r\n]*)(?<value>\[?[^:]*)$/;
        const beginningToCursor = new Range(0, 0, position.line, position.character);
        const textSoFar = document.getText(beginningToCursor);
        const matches = textSoFar.match(regexp);
        if (matches) {
            const {
                sep: separator,
                value
            } = matches.groups;

            const startIndex = position.character - value.length - separator.length;
            const range = new Range(position.line, startIndex, position.line, Number.MAX_SAFE_INTEGER);

            // TODO: add variables that have been used in this document (to the beginning)
            const allSeverities = [
                "\"error\"",
                "\"warn\"",
                "\"off\"",
                "2",
                "1",
                "0"
            ];

            return [
                ...allSeverities.map(severity => {
                    // displays (label): severity
                    // filtered by user typing (filterText)
                    const item = new InlineCompletionItem(severity, CompletionItemKind.Property);
                    item.filterText = `${separator}${severity}`;
                    item.insertText = `: ${severity},`;
                    item.range = range;

                    return item;
                }),
                ...allSeverities.map(severity => {
                    // displays (label): severity
                    // filtered by user typing (filterText)
                    const item = new InlineCompletionItem(`[${severity}, ]`, CompletionItemKind.Property);
                    item.filterText = `${separator}[${severity}]`;
                    item.insertText = new SnippetString(`: [${severity}, \$0],`);
                    item.range = range;

                    return item;
                })
            ];
        }
    },
};
