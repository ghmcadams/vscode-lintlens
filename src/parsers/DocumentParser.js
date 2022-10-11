import { languages } from 'vscode';
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

        if (new.target === DocumentParser) {
            // Choose parser based on filename and language
            if (isMatch('javascript', '**/eslint.config.js') || isMatch('javascriptreact', '**/eslint.config.js')) {
                return new FlatConfigParser(document);
            } else if (isMatch('javascript', '**/.eslintrc.js', '**/.eslintrc.cjs') || isMatch('javascriptreact', '**/.eslintrc.js', '**/.eslintrc.cjs')) {
                return new JSParser(document);
            } else if (isMatch('json', '**/.eslintrc', '**/.eslintrc.json') || isMatch('jsonc', '**/.eslintrc', '**/.eslintrc.json')) {
                return new JSONParser(document);
            } else if (isMatch('yaml', '**/.eslintrc', '**/.eslintrc.yaml', '**/.eslintrc.yml')) {
                return new YAMLParser(document);
            } else if (isMatch('json', '**/package.json')) {
                return new PkgParser(document);
            }
    
            // If code reaches here, a standard parser with no functionality will be returned
            // TODO: this might cause silent "not working" cases
        }
    }
}
