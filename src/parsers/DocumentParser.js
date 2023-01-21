import { basename } from 'path';
import JSParser, { ESLintConfigType } from './JSParser';
import YAMLParser from './YAMLParser';


export function getParser(document) {
    if (document.uri.scheme !== 'file') {
        return;
    }

    const fileName = basename(document.fileName);
    const languageId = document.languageId;

    if (languageId === 'yaml') {
        return new YAMLParser(document);
    }

    if (['javascript', 'javascriptreact', 'json', 'jsonc'].includes(languageId)) {
        if (fileName === 'eslint.config.js') {
            return new JSParser(document, { configType: ESLintConfigType.Flat });
        }

        if (['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', 'package.json'].includes(fileName)) {
            return new JSParser(document, { configType: ESLintConfigType.Legacy });
        }

        return new JSParser(document);
    }
}
