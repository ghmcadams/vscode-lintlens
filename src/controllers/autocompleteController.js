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
        const regexp = /(?<=[{,])\s*?(?<openQuote>[\"\'\`]?)(?<ruleId>@?[\w-]+\/?[\w-]*(-?[\w-])*)(?<closeQuote>\k<openQuote>?)(?<separator>[^\S\r\n]*:?[^\S\r\n]*)(?<value>\[?(?:[0-2]|([\"\'\`]((o(f(f)?)?)|(w(a(r(n)?)?)?)?|(e(r(r(o(r)?)?)?)?)?))?))$/;
        const beginningToCursor = new Range(0, 0, position.line, position.character);
        const textSoFar = document.getText(beginningToCursor);

        // Do not support editing existing text
        const line = document.lineAt(position).text.slice(position.character);
        if (line.length > 1) {
            return;
        }

        const matches = textSoFar.match(regexp);
        if (matches) {
            const {
                openQuote,
                ruleId,
                closeQuote,
                separator,
                value
            } = matches.groups;

            if (closeQuote === '') {
                // Autocomplete rule Id
                const startIndex = position.character - ruleId.length - openQuote.length;
                const endIndex = position.character + openQuote.length;
                const range = new Range(position.line, startIndex, position.line, endIndex);

                const allRules = getAllRuleIds(document.fileName)
                    .map(rule => (`${openQuote}${rule}${openQuote}: `));

                return allRules.map(insertText => ({
                    insertText,
                    range
                }));
            }

            // Autocomplete severity
            const beforeColon = separator.split(':')[0];

            const startIndex = position.character - value.length - separator.length;
            const endIndex = position.character;
            const range = new Range(position.line, startIndex, position.line, endIndex);

            const allSeverities = [
                "\"error\"",
                "\"warn\"",
                "\"off\"",
                "2",
                "1",
                "0"
            ];

            const options = [
                ...allSeverities.map(severity => (`${beforeColon}: ${severity}`)),
                ...allSeverities.map(severity => (`${beforeColon}: [${severity}, `))
            ];

            return options.map(insertText => ({
                insertText,
                range
            }));
        }
    },
};
