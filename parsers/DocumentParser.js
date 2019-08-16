const vscode = require('vscode');
const Parser = require('./Parser');
const JSONParser = require('./JSONParser');
const JSParser = require('./JSParser');
const YAMLParser = require('./YAMLParser');
const PkgParser = require('./PkgParser');


module.exports = class DocumentParser extends Parser {
    constructor(document) {
        super(document);

        function isMatch(pattern, language) {
            return vscode.languages.match({ pattern, scheme: 'file', language }, document) > 0;
        }

        if (new.target === DocumentParser) {
            if (isMatch('**/.eslintrc.js', 'javascript')) {
                return new JSParser(document);
            } else if (isMatch('**/.eslintrc.json', 'json')) {
                return new JSONParser(document);
            } else if (isMatch('**/.eslintrc.json', 'jsonc')) {
                return new JSONParser(document);
            } else if (isMatch('**/.eslintrc.yaml', 'yaml')) {
                return new YAMLParser(document);
            } else if (isMatch('**/.eslintrc.yml', 'yaml')) {
                return new YAMLParser(document);
            } else if (isMatch('**/.eslintrc', 'json')) {
                return new JSONParser(document);
            } else if (isMatch('**/.eslintrc', 'jsonc')) {
                return new JSONParser(document);
            } else if (isMatch('**/.eslintrc', 'yaml')) {
                return new YAMLParser(document);
            } else if (isMatch('**/package.json', 'json')) {
                return new PkgParser(document);
            }
    
            // If code reaches here, a standard parser with no functionality will be returned
        }
    }
}
