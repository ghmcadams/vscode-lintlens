import { Range } from 'vscode';


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
        const regexp = /(?<=[{,])\s*?(?<q>[\"\'\`]?)[^\"\'\`\s]+\k<q>?(?<sep>[^\S\r\n]*:[^\S\r\n]*)(?<value>\[?(?:[0-2]|([\"\'\`]((o(f(f)?)?)|(w(a(r(n)?)?)?)?|(e(r(r(o(r)?)?)?)?)?))?))$/;
        // SINGLE LINE:   /^[\t ]*?(?<q>[\"\'\`]?)(?<ruleId>[^\"\'\`\s]+)\k<q>?(?<sep>(?<ws>[^\S\r\n]*):[^\S\r\n]*)(?<value>\[?(?:[0-2]|([\"\'\`]((o(f(f)?)?)|(w(a(r(n)?)?)?)?|(e(r(r(o(r)?)?)?)?)?))?))$/
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
                sep: separator,
                value
            } = matches.groups;

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
                ...allSeverities.map(severity => (`${beforeColon}: ${severity},`)),
                ...allSeverities.map(severity => (`${beforeColon}: [${severity}, `)),
            ];

            return options.map(insertText => ({
                insertText,
                range
            }));
        }
    },
};
