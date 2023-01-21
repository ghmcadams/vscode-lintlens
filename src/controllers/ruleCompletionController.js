import { languages, Range, CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import * as vscode from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { getAllRuleIds } from '../rules';


export function initialize(context) {
    const documentSelectors = [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'json', scheme: 'file' },
        { language: 'jsonc', scheme: 'file' }
    ];

    documentSelectors.forEach(selector => {
        context.subscriptions.push(languages.registerCompletionItemProvider(selector, provider, "'", "`", "\"", "\n"));
    });
}

const provider = {
    provideCompletionItems: (document, position, cancelToken, context) => {
        const parser = getParser(document);
        if (!parser) {
            return;
        }

        const eslintConfig = parser.getConfig();

        const isValid = validatePosition(eslintConfig, position);
        if (!isValid) {
            return;
        }

        // Create completions

        const regexp = /^(?:.+,)?[\t ]*(?<q>[\"\'\`]?)(?<r>@?[\/\w-]*)$/;
        const entryRange = new Range(position.line, 0, position.line, position.character);
        const text = document.getText(entryRange);
        const matches = text.match(regexp);
        if (matches) {
            const {
                q: openQuote,
                r: ruleId
            } = matches.groups;

            const startIndex = position.character - ruleId.length - openQuote.length;
            const range = new Range(position.line, startIndex, position.line, Number.MAX_SAFE_INTEGER);

            const allRules = getAllRuleIds(document.fileName);
            // const severityOptions = '[${1|"error","warn","off"|}$0],'; // this works for severity in an array

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
    }
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
            if (!rule.configuration && rule.key.range.contains(position) && rule.key.name === '') {
                return true;
            }

            // within a rule (not adding a new one)
            return false;
        }
    }

    return true;
}
