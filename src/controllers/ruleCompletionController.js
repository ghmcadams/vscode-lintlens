import { languages, Range, CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import * as vscode from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { EntryType } from '../parsers/Parser';
import { getAllRuleIds } from '../rules';


const AreaType = {
    RulesContainer: 'RulesContainer',
    EmptyRule: 'EmptyRule',
    Rule: 'Rule',
    Key: 'Key',
    Value: 'Value',
    Severity: 'Severity',
    Options: 'Options',
    Other: 'Other'
};


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

        const positionInfo = getPositionInfo(eslintConfig, position);
        if (positionInfo === null) {
            return;
        }
        if (![
            AreaType.EmptyRule,
            AreaType.Key,
            AreaType.RulesContainer
        ].includes(positionInfo.type)) {
            return;
        }

        // Create completions

        let entryRange;
        switch(positionInfo.type) {
            case AreaType.RulesContainer:
                entryRange = new Range(position, position);
                break;
            case AreaType.Key:
            case AreaType.EmptyRule:
                entryRange = new Range(positionInfo.range.start, position);
                break;
        }

        if (!entryRange) {
            return;
        }

        const areaText = document.getText(entryRange);
        const openQuote = areaText[0] ?? '';

        const range = new Range(entryRange.start.line, entryRange.start.character, position.line, Number.MAX_SAFE_INTEGER);

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
};

function getPositionInfo(eslintConfig, position) {
    const rulesContainers = eslintConfig.flatMap(section => section.rules);

    if (rulesContainers.length === 0) {
        // There are no rules containers in this document
        return null;
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
        return null;
    }

    for (const entry of activeContainer.entries) {
        // Within an entry
        if (entry.range.contains(position)) {
            if (entry.type === EntryType.EmptyRule) {
                return {
                    type: AreaType.EmptyRule,
                    range: entry.range
                };
            }
            if (entry.type === EntryType.Rule) {
                let type = AreaType.Rule;
                let range = entry.range;

                if (entry.key.range.contains(position)) {
                    type = AreaType.Key;
                    range = entry.key.range;
                } else if (entry.configuration?.range.contains(position)) {
                    type = AreaType.Value;
                    range = entry.configuration.range;

                    if (entry.configuration.severityRange?.range.contains(position)) {
                        type = AreaType.Severity;
                        range = entry.configuration.configuration.severityRange;
                    } else if (entry.configuration.optionsRange?.range.contains(position)) {
                        type = AreaType.Options;
                        range = entry.configuration.configuration.optionsRange;
                    }
                }

                return {
                    type,
                    range
                };
            }

            return {
                type: AreaType.Other,
                range: entry.range
            };
        }
    }

    return {
        type: AreaType.RulesContainer,
        range: activeContainer.range
    };
}
