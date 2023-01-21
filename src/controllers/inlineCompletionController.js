import { Range, InlineCompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import { getParser } from '../parsers/DocumentParser';


let extensionContext;

export function initialize(context) {
    extensionContext = context;
}

export const provider = {
    provideInlineCompletionItems: async (document, position, context, cancelToken) => {
        const parser = getParser(document);
        const eslintConfig = parser.getConfig();

        const isValid = validatePosition(eslintConfig, position);
        if (!isValid) {
            return;
        }

        // Create completions

        const regexp = /^(?:.+,)?.+(?<sep>[^\S\r\n]*:[^\S\r\n]*)(?<value>\[?[^:]*)$/;
        const entryRange = new Range(position.line, 0, position.line, position.character);
        const text = document.getText(entryRange);
        const matches = text.match(regexp);
        if (matches) {
            const {
                sep: separator,
                value
            } = matches.groups;

            const startIndex = position.character - value.length - separator.length;
            const range = new Range(position.line, startIndex, position.line, Number.MAX_SAFE_INTEGER);

            // TODO: add variables that have been used in this document (to the beginning)
            //      could the parser return variables used?
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

function validatePosition(eslintConfig, position) {
    const rulesContainers = eslintConfig.flatMap(section => section.rules);

    if (rulesContainers.length === 0) {
        // There are no rules containers in this document
        return false;
    }

    let activeContainer = null;
    for (const container of rulesContainers) {
        if (container.range.contains(position)) {
            activeContainer = container;
            break;
        }
    }
    if (activeContainer === null) {
        // Not in a rules container
        return false;
    }

    for (const rule of activeContainer.entries) {
        if (rule.range.contains(position)) {
            // within a rule, but not in the key = starting the value
            return !rule.key.range.contains(position);
            // return rule.configuration?.range?.contains(position);
        }
    }

    // not within a rule value
    return false;
}
