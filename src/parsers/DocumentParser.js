import { languages } from 'vscode';
import Parser from './Parser';
import JSONParser from './JSONParser';
import JSParser from './JSParser';
import YAMLParser from './YAMLParser';
import PkgParser from './PkgParser';


export default class DocumentParser extends Parser {
    constructor(document) {
        super(document);

        if (new.target === DocumentParser) {
            if (languages.match({ pattern: '**/.eslintrc.js', scheme: 'file', language: 'javascript' }, document) > 0) {
                return new JSParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc.json', scheme: 'file', language: 'jsonc' }, document) > 0) {
                return new JSONParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc.json', scheme: 'file', language: 'json' }, document) > 0) {
                return new JSONParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc.yaml', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc.yml', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'jsonc' }, document) > 0) {
                return new JSONParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'json' }, document) > 0) {
                return new JSONParser(document);
            } else if (languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'yaml' }, document) > 0) {
                return new YAMLParser(document);
            } else if (languages.match({ pattern: '**/package.json', scheme: 'file', language: 'json' }, document) > 0) {
                return new PkgParser(document);
            }
    
            // If code reaches here, a standard parser with no functionality will be returned
        }
    }
}
