const vscode = require('vscode');
const Parser = require('./Parser');
const JSONParser = require('./JSONParser');
const JSParser = require('./JSParser');
const YAMLParser = require('./YAMLParser');
const PkgParser = require('./PkgParser');


module.exports = class DocumentParser extends Parser {
    constructor(document) {
        super(document);

        if (new.target === DocumentParser) {
            if (vscode.languages.match({ pattern: '**/.eslintrc.js', scheme: 'file', language: 'javascript' }, document) > 0) {
                return new JSParser(document);
            } else if (vscode.languages.match({ pattern: '**/.eslintrc.json', scheme: 'file', language: 'json' }, document) > 0) {
                return new JSONParser(document);
            } else if (vscode.languages.match({ pattern: '**/.eslintrc.yaml', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (vscode.languages.match({ pattern: '**/.eslintrc.yml', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (vscode.languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'json' }, document) > 0) {
                return new JSONParser(document);
            } else if (vscode.languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (vscode.languages.match({ pattern: '**/package.json', scheme: 'file', language: 'json' }, document) > 0) {
                return new PkgParser(document);
            }
    
            // If code reaches here, a standard parser with no functionality will be returned
        }
    }
}
