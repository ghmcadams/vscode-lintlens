import { Position } from 'vscode';


export function initialize(context) {
}

export function replaceRange(editor, edit, ...[ rangeStartLine, rangeStartCharacter, rangeEndLine, rangeEndCharacter, newText ]) {
    const position = new Position(rangeStartLine, rangeStartCharacter + 1);
    const range = editor.document.getWordRangeAtPosition(position, /[^\s\:\"\']+/);
    edit.replace(range, newText);
}
