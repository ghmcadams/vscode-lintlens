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
            ^\{(?:\s*(?:(?:[\"\'\`]?@?[\/\w-]+[\"\'\`]?\s*:\s*)?(?:(?:(?:\.\.\.)?[\"\'\`]?\w+[\"\'\`]?)|(?:\[\s*[^\[\]]*(?:\[[^\[\]]*\])*[^\[\]]*\]))\s*,)?(?:\s*\/\/[^\r\n]*\n)?)*(?<q>[\"\'\`]?)(?<r>@?[\/\w-]*)$

            ^                                                               # beginning of string
            \{                                                              # open object bracket
            (?<other>                                                       # group (an other thing)
                \s*                                                         # whitespace (zero or more)
                (?<keyvalue>                                                # group (key/value pair)
                    (?<keysep>                                              # group (key and separator)
                        [\"\'\`]?                                           # quote (zero or one)
                        @?[\/\w-]+                                          # key string character (one or more)
                        [\"\'\`]?                                           # quote (zero or one)
                        \s*:\s*                                             # whitespace (zero or more), colon, whitespace (zero or more)
                    )?                                                      # close group (keysep)
                    (?<value>                                               # group (value)
                        (?<simple>                                          # group (simple value)
                            (?<spread>\.\.\.)?                              # spread dots (zero or one)
                            [\"\'\`]?                                       # quote (zero or one)
                            [\w\.\[\]]+                                     # variable character (one or more)
                            [\"\'\`]?                                       # quote (zero or one)
                        )                                                   # close group (simple value)
                        |                                                   # OR
                        (?<array>                                           # group (array value)
                            \[                                              # open array bracket
                            \s*                                             # whitespace (zero or more)
                            [^\[\]]*                                        # any character other than open or close array brackets (zero or more)
                            (?<embedddarray>                                # group (embedded array)
                                \[                                          # open array bracket
                                [^\[\]]*                                    # any character other than open or close array brackets (zero or more)
                                \]                                          # close array bracket
                            )*                                              # close group (embedded array)
                            [^\[\]]*                                        # any character other than open or close array brackets (zero or more)
                            \]                                              # close array bracket
                        )                                                   # close group (array value)
                    )                                                       # close group (value)
                    \s*                                                     # whitespace (zero or more)
                    ,                                                       # comma
                )?                                                          # close group (key/value pair)
                (?<comment>\s*\/\/[^\r\n]*\n)?                              # line comment
            )*                                                              # close group (zero or more)
            (?<q>[\"\'\`]?)                                                 # current quote (if exists)
            (?<r>@?[\/\w-]*)                                                # start of current rule id (if exists)
            $                                                               # end of string

        */
        const regexp = /^\{(?:\s*(?:(?:[\"\'\`]?@?[\/\w-]+[\"\'\`]?\s*:\s*)?(?:(?:(?:\.\.\.)?[\"\'\`]?[\w\.\[\]]+[\"\'\`]?)|(?:\[\s*[^\[\]]*(?:\[[^\[\]]*\])*[^\[\]]*\]))\s*,)?(?:\s*\/\/[^\r\n]*\n)?)*(?<q>[\"\'\`]?)(?<r>@?[\/\w-]*)$/;
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
