import { Range, Position, CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import * as vscode from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { getAllRuleIds } from '../rules';


let extensionContext;

export function initialize(context) {
    extensionContext = context;
}

export const provider = {
    provideCompletionItems: (document, position, cancelToken, context) => {
        const parser = getParser(document);
        const rulesContainers = parser.getRulesContainers();
        if (rulesContainers.length === 0) {
            return;
        }

        let rulesContainerRange = null;
        for (const container of rulesContainers) {
            if (container.contains(position)) {
                rulesContainerRange = container;
                break;
            }
        }
        if (rulesContainerRange === null) {
            // Not in a rules container
            return;
        }

        // Determine if user is typing a new object key (assume ESLint rule)
        /*
            ^                       # beginning of string
            \{\s*                   # object opener and maybe whitespace
            (?:                     # group (prior rules in the object)
                [\"\'\`]?           # quote of some kind (maybe)
                @?[\/\w-]+          # rule text
                [\"\'\`]?           # quote of some kind (maybe)
                \s*:\s*             # separator (with any amount of whitespace)
                (?:                 # group (value)

                    (?:[\"\'\`]?\w+[\"\'\`]?)                                                  # simple severity option value
                    |                                                                          # OR
                    (?:\[\s*[\"\'\`]?\w+[\"\'\`]?\s*,\s*[^\[\]]*(?:\[[^\[\]]*\])*[^\[\]]*\])   # array option value

                    #  break apart array option value
                        \[                              # open bracket
                            \s*                         # whitespace (maybe)
                            [\"\'\`]?\w+[\"\'\`]?       # severity
                            \s*,\s*                     # comma (with or without whitespace)
                            [^\[\]]*                    # any amount of non array things
                            (?:\[[^\[\]]*\])*           # inner array (any number of these)
                            [^\[\]]*                    # any amount of non array things
                        \]                              # close bracket
                    # end break apart array option value

                )                   # close group (value)

                \s*,\s*             # comma and maybe whitespace
            )*                      # close group (zero or more)
            (?<q>[\"\'\`]?)         # current quote (if exists)
            (?<r>@?[\/\w-]*)        # start of current rule id (if exists)
            $                       # end of string
        */
        const regexp = /^\{\s*(?:[\"\'\`]?@?[\/\w-]+[\"\'\`]?\s*:\s*(?:(?:[\"\'\`]?\w+[\"\'\`]?)|(?:\[\s*[\"\'\`]?\w+[\"\'\`]?\s*,\s*[^\[\]]*(?:\[[^\[\]]*\])*[^\[\]]*\]))\s*,\s*)*(?<q>[\"\'\`]?)(?<r>@?[\/\w-]*)$/;
        const beginningToCursor = new Range(rulesContainerRange.start.line, rulesContainerRange.start.character, position.line, position.character);
        const textSoFar = document.getText(beginningToCursor);
        const matches = textSoFar.match(regexp);
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



function validatePosition(text) {
    /*
        {
            "max": ["error",
                {
                    "someConfigThing": 2 
                },
                {
                    "anotherThing": "something",
                    "anotherProp": true
                },
                "anotherRuleProp"
            ],
            "rule3": "error",
            "rule4


    IDEA:  use parser in this controller as well
        modify parsers to give more than just rules
        try out acorn-loose parser, to see if it is more forgiving and still works the say I need
        structure something like { extends: {}, plugins: {}, rules: { containers (better name needed): [], allRules: [] } }
        THEN determine if I am within a rule container
        THEN (not sure how) determine if I am adding a key or value
    */
}
