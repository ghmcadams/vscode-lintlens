import { basename } from 'path';
import JSParser, { ESLintConfigType } from './JSParser';
import YAMLParser from './YAMLParser';


export function getParser(document) {
    if (document.uri.scheme !== 'file') {
        return;
    }

    const fileName = basename(document.fileName);
    const languageId = document.languageId;

    // ESLint and StyleLint config files match closely in structure and are sometimes matched incorrectly
    // Although any file could be either, for now, if the filename contains stylelint, ignore
    // TODO: determine non-eslint configs based only on content
    if (fileName.includes('stylelint')) {
        return;
    }

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
