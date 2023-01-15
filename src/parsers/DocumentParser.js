import { languages, workspace } from 'vscode';
import Parser from './Parser';
import JSONParser from './JSONParser';
import JSParser from './JSParser';
import FlatConfigParser from './FlatConfigParser';
import YAMLParser from './YAMLParser';
import PkgParser from './PkgParser';


export default class DocumentParser extends Parser {
    constructor(document) {
        super(document);

        function isMatch(language, ...patterns) {
            return patterns.some(pattern => {
                const selector = {
                    pattern,
                    scheme: 'file',
                    language
                };
                return (languages.match(selector, document) > 0);
            });
        }

        function isLanguageMatch(...codeLanguages) {
            return codeLanguages.some(language => {
                const selector = {
                    scheme: 'file',
                    language
                };
                return (languages.match(selector, document) > 0);
            });
        }

        if (new.target === DocumentParser) {
            // Choose parser based on filename and language
            if (isMatch('javascript', '**/eslint.config.js') || isMatch('javascriptreact', '**/eslint.config.js')) {
                return new FlatConfigParser(document);
            } else if (isMatch('javascript', '**/.eslintrc.js', '**/.eslintrc.cjs') || isMatch('javascriptreact', '**/.eslintrc.js', '**/.eslintrc.cjs')) {
                return new JSParser(document);
            } else if (isMatch('typescript', '**/.eslintrc.js', '**/.eslintrc.cjs') || isMatch('typescriptreact', '**/.eslintrc.js', '**/.eslintrc.cjs')) {
                return new JSParser(document);
            } else if (isMatch('json', '**/.eslintrc', '**/.eslintrc.json') || isMatch('jsonc', '**/.eslintrc', '**/.eslintrc.json')) {
                return new JSONParser(document);
            } else if (isMatch('yaml', '**/.eslintrc', '**/.eslintrc.yaml', '**/.eslintrc.yml')) {
                return new YAMLParser(document);
            } else if (isMatch('json', '**/package.json')) {
                return new PkgParser(document);
            }

            // Choose parser based on language
            if (isLanguageMatch('javascript', 'javascriptreact', 'typescript', 'typescriptreact')) {
                // TODO: determine flat config vs legacy JS config
                // TODO: try to parse one and then try the other?
                return new JSParser(document);
            } else if (isLanguageMatch('json')) {
                return new JSONParser(document);
            } else if (isLanguageMatch('yaml')) {
                return new YAMLParser(document);
            }
        }
    }
}
