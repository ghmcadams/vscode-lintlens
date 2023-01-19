import { languages } from 'vscode';
import JSParser, { ESLintConfigType } from './JSParser';
import JSONParser from './JSONParser';
import YAMLParser from './YAMLParser';
import PkgParser from './PkgParser';


export function getParser(document) {
    // Choose parser based on filename and language
    if (isMatch(document, 'javascript', '**/eslint.config.js') || isMatch(document, 'javascriptreact', '**/eslint.config.js')) {
        return new JSParser(document, ESLintConfigType.Flat);
    } else if (isMatch(document, 'javascript', '**/.eslintrc.js', '**/.eslintrc.cjs') || isMatch(document, 'javascriptreact', '**/.eslintrc.js', '**/.eslintrc.cjs')) {
        return new JSParser(document, ESLintConfigType.Legacy);
    } else if (isMatch(document, 'typescript', '**/.eslintrc.js', '**/.eslintrc.cjs') || isMatch(document, 'typescriptreact', '**/.eslintrc.js', '**/.eslintrc.cjs')) {
        return new JSParser(document, ESLintConfigType.Legacy);
    } else if (isMatch(document, 'json', '**/.eslintrc', '**/.eslintrc.json') || isMatch(document, 'jsonc', '**/.eslintrc', '**/.eslintrc.json')) {
        return new JSONParser(document);
    } else if (isMatch(document, 'yaml', '**/.eslintrc', '**/.eslintrc.yaml', '**/.eslintrc.yml')) {
        return new YAMLParser(document);
    } else if (isMatch(document, 'json', '**/package.json')) {
        return new PkgParser(document);
    }

    // Choose parser based on language
    if (isLanguageMatch(document, 'javascript', 'javascriptreact', 'typescript', 'typescriptreact')) {
        return new JSParser(document);
    } else if (`isLanguageMatch`(document, 'json')) {
        return new JSONParser(document);
    } else if (isLanguageMatch(document, 'yaml')) {
        return new YAMLParser(document);
    }
}

function isMatch(document, language, ...patterns) {
    return patterns.some(pattern => {
        const selector = {
            pattern,
            scheme: 'file',
            language
        };
        return (languages.match(selector, document) > 0);
    });
}

function isLanguageMatch(document, ...codeLanguages) {
    return codeLanguages.some(language => {
        const selector = {
            scheme: 'file',
            language
        };
        return (languages.match(selector, document) > 0);
    });
}
