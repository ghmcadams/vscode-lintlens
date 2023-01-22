import { languages, Range, InlineCompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { EntryType } from '../parsers/Parser';


const AreaType = {
    RulesContainer: 'RulesContainer',
    EmptyRule: 'EmptyRule',
    EmptyValue: 'EmptyValue',
    Rule: 'Rule',
    Key: 'Key',
    Value: 'Value',
    Severity: 'Severity',
    Options: 'Options',
    Other: 'Other'
};


export function initialize(context) {
    // const documentSelectors = [
    //     { language: 'javascript', scheme: 'file' },
    //     { language: 'javascriptreact', scheme: 'file' },
    //     { language: 'json', scheme: 'file' },
    //     { language: 'jsonc', scheme: 'file' }
    // ];

    // documentSelectors.forEach(selector => {
    //     context.subscriptions.push(languages.registerInlineCompletionItemProvider(selector, provider));
    // });
}

const provider = {
    provideInlineCompletionItems: (document, position, context, cancelToken) => {
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
            AreaType.EmptyValue,
            AreaType.Value,
            AreaType.Severity
        ].includes(positionInfo.type)) {
            return;
        }

        // Create completions

        const entryRange = new Range(positionInfo.range.start, position);
        const areaText = document.getText(entryRange);
        const regex = /^(?<b>:?\s*).*$/;
        const matches = areaText.match(regex);
        let before = '';
        if (matches) {
            before = matches.groups.b;
        }

        console.log('Text: ', areaText);
        const range = new Range(positionInfo.range.start.line, entryRange.start.character, position.line, Number.MAX_SAFE_INTEGER);

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
            if (entry.type === EntryType.EmptyValue) {
                const type = AreaType.EmptyValue;

                if (entry.valueRange.contains(position)) {
                    return {
                        type,
                        range: entry.valueRange
                    };
                }

                return {
                    type,
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
