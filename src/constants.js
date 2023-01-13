export const commands = {
    openWebViewPanel: 'lintlens.openWebView',
    openInBrowser: 'lintlens.openInBrowser',
    replaceText: 'lintlens.replaceText',
};

export const extensionId = 'lintlens';
export const extensionName = 'LintLens';

export const glyphs = {
    checkmark: '\u2705', // ✅
    arrowIcon: '\u2197', // ↗
    wrenchIcon: '\uD83D\uDD27', // 🔧
    NoEntryIcon: '\uD83D\uDEAB', // 🚫
    lightbulbIcon: '\uD83D\uDCA1', // 💡
    emptyIcon: '\u2205', // ∅
    magnifyIcon: '\uD83D\uDD0E', // 🔍
    dot: '\u22C5', // ⋅
    circledTwo: '\u2461', // ②
    redXIcon: '\u274c' // ❌
};

export const npmPackageBaseUrl = 'https://www.npmjs.com/package/';
export const eslintRulesUrl = 'https://eslint.org/docs/rules/';
export const MISSING_URL_URL = 'https://github.com/ghmcadams/vscode-lintlens/wiki/Missing-Rule-Docs-URL';
export const eslintPluginPrefix = 'eslint-plugin';

export const messages = {
    missingRule: '',
    missingPlugin: '',
    duplicateRule: 'duplicate rule configuration',
    validationError: 'validation error(s) in options configuration'
};
