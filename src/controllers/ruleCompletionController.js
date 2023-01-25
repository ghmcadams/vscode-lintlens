import { languages, Range, CompletionItem, InlineCompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import * as vscode from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { EntryType } from '../parsers/Parser';
import { getAllRuleIds } from '../rules';


export function initialize(context) {
    const documentSelectors = [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'json', scheme: 'file' },
        { language: 'jsonc', scheme: 'file' }
    ];

    documentSelectors.forEach(selector => {
        context.subscriptions.push(languages.registerCompletionItemProvider(selector, ruleIdProvider, "'", "`", "\"", "\n"));
        context.subscriptions.push(languages.registerInlineCompletionItemProvider(selector, ruleValueProvider));
});
}

const ruleIdProvider = {
    provideCompletionItems: (document, position, cancelToken, context) => {
        const parser = getParser(document);
        if (!parser) {
            return;
        }

        const positionRange = parser.getActiveRange(position);

        if (positionRange === null) {
            return;
        }
        if (![
            EntryType.RulesContainer,
            EntryType.EmptyRule,
            EntryType.RuleKey
        ].includes(positionRange.type)) {
            return;
        }

        // Create completions

        let entryRange;
        switch(positionRange.type) {
            case EntryType.RulesContainer:
                entryRange = new Range(position, position);
                break;
            case EntryType.EmptyRule:
            case EntryType.RuleKey:
                entryRange = new Range(positionRange.start, position);
                break;
        }

        if (!entryRange) {
            return;
        }

        const areaText = document.getText(entryRange);
        const openQuote = areaText[0] ?? '';

        const range = new Range(entryRange.start.line, entryRange.start.character, position.line, Number.MAX_SAFE_INTEGER);

        const allRules = getAllRuleIds(document.fileName);

        return allRules.map(rule => {
            // displays (label): rule
            // filtered by user typing (filterText)
            const item = new CompletionItem(rule, CompletionItemKind.Property);
            item.filterText = `${openQuote}${rule}`;
            // item.insertText = new SnippetString(`"${rule}": \${1|"error","warn","off"|},$0`);
            item.insertText = `"${rule}": `;
            item.range = range;

            // TODO: get rule description (from meta), defaulting to something standard (ESLint Rule ${rule} ??)
            // const docs = new vscode.MarkdownString(`Inserts the ${rule} ESLint rule`);
            // item.documentation = docs;
            // TODO: get URL for rule (from meta)
            // docs.baseUri = vscode.Uri.parse('http://example.com/a/b/c/');

            // TODO: put this here when config options autocomplete works
            // item.command = { command: 'editor.action.triggerSuggest' };

            return item;
        });
    }
};

const ruleValueProvider = {
    provideInlineCompletionItems: (document, position, context, cancelToken) => {
        const parser = getParser(document);
        if (!parser) {
            return;
        }

        const positionRange = parser.getActiveRange(position);

        if (positionRange === null) {
            return;
        }
        if (![
            EntryType.RuleValue,
            EntryType.EmptyRuleValue,
        ].includes(positionRange.type)) {
            return;
        }

        // Create completions

        const entryRange = new Range(positionRange.start, position);
        const areaText = document.getText(entryRange);
        const regex = /^(?<b>:?\s*).*$/;
        const matches = areaText.match(regex);
        let before = '';
        if (matches) {
            before = matches.groups.b;
        }

        console.log('Text: ', areaText);
        const range = new Range(positionRange.start.line, entryRange.start.character, position.line, Number.MAX_SAFE_INTEGER);

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
                item.filterText = `${before}${severity}`;
                item.insertText = `${before}${severity},`;
                item.range = range;

                return item;
            }),
            ...allSeverities.map(severity => {
                // displays (label): severity
                // filtered by user typing (filterText)
                const item = new InlineCompletionItem(`[${severity}, ]`, CompletionItemKind.Property);
                item.filterText = `${before}[${severity}]`;
                item.insertText = new SnippetString(`${before}[${severity}, \$0],`);
                item.range = range;

                return item;
            })
        ];
    },
};
