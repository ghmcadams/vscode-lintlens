module.exports = {
    commands: {
        openWebViewPanel: 'lintlens.openWebView',
        openInBrowser: 'lintlens.openInBrowser',
        replaceText: 'lintlens.replaceText',
    },

    extensionId: 'lintlens',
    extensionName: 'LintLens',

    glyphs: {
        thumbsUpIcon: '\uD83D\uDC4D',
        arrowIcon: '\u2197',
        wrenchIcon: '\uD83D\uDD27',
        NoEntryIcon: '\uD83D\uDEAB',
        lightbulbIcon: '\uD83D\uDCA1',
        emptyIcon: '\u2205',
        magnifyIcon: '\uD83D\uDD0E',
        dot: '\u22C5',
        plusInCircle: '\u2A2E'
    },

    npmPackageBaseUrl: 'https://www.npmjs.com/package/',
    eslintRulesUrl: 'https://eslint.org/docs/rules/',
    MISSING_URL_URL: 'https://github.com/ghmcadams/vscode-lintlens/wiki/Missing-Rule-Docs-URL'
};
