import { Position } from 'vscode';


export function initialize(context) {
}

export function replaceRange(editor, edit, ...[ rangeStartLine, rangeStartCharacter, rangeEndLine, rangeEndCharacter, newText ]) {
    range = editor.document.getWordRangeAtPosition(new Position(rangeStartLine, rangeStartCharacter + 1), /[^\s\:\"\']+/);
    edit.replace(range, newText);
}
