import { window, workspace, languages, MarkdownString, DecorationRangeBehavior, ThemeColor, DiagnosticSeverity } from 'vscode';
import DocumentParser from '../parsers/DocumentParser';
import { getRuleDetails } from '../rules';
import { glyphs, extensionName, commands, messages } from '../constants';
import { validateConfigFromSchema } from '../schema';

const annotationDecoration = window.createTextEditorDecorationType({});
const validationCollection = languages.createDiagnosticCollection('validation');

export function initialize(context) {
    let activeEditor = window.activeTextEditor;

    // generate when document is made active
    window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            addAnnotations(editor);
        }
	}, null, context.subscriptions);

    // generate when the document is edited
    workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
            addAnnotations(activeEditor);
		}
	}, null, context.subscriptions);

    // generate on start
	if (activeEditor) {
		addAnnotations(activeEditor);
	}
}

export function clearAnnotations(editor) {
    if (editor === undefined || editor._disposed === true) {
        return;
    }
    editor.setDecorations(annotationDecoration, []);
    validationCollection.clear();
}

export function addAnnotations(editor) {
    if (editor === undefined || editor._disposed === true || editor.document === undefined) {
        return;
    }

    const parser = new DocumentParser(editor.document);
    const rules = parser.getRules();
    if (rules.length === 0) {
        return clearAnnotations(editor);
    }

    try {
        const validationErrors = [];
        const decorations = rules.map(rule => {
            try {
                const ruleInfo = getRuleDetails(editor.document.fileName, rule.name);

                // validate rule config options
                let ruleHasValidationErrors = false;
                if (rule.value) {
                    const { valid, errors } = validateConfigFromSchema(ruleInfo.schema, rule.value);
                    if (!valid) {
                        ruleHasValidationErrors = true;
    
                        validationErrors.push(...errors.map(error => ({
                            source: 'LintLens',
                            range: rule.valueRange,
                            severity: DiagnosticSeverity.Error,
                            message: error,
                        })));
                    }
                }

                // add diagnostics for duplicated and deprecated rules
                if (!ruleInfo.isRuleFound) {
                    validationErrors.push({
                        source: 'LintLens',
                        range: rule.keyRange,
                        severity: DiagnosticSeverity.Error,
                        message: `Rule "${rule.name}" not found`,
                    });
                }
                if (rule.duplicate) {
                    validationErrors.push({
                        source: 'LintLens',
                        range: rule.keyRange,
                        severity: DiagnosticSeverity.Hint,
                        message: messages.duplicateRule,
                    });
                }
                if (ruleInfo.isDeprecated) {
                    validationErrors.push({
                        source: 'LintLens',
                        range: rule.keyRange,
                        severity: DiagnosticSeverity.Warning,
                        message: `Rule "${rule.name}" is deprecated`,
                    });
                }
    
                // Create annotation decoration
                const contentText = getContentText(rule, ruleInfo, ruleHasValidationErrors);
                const hoverMessage = getHoverMessage(rule, ruleInfo, ruleHasValidationErrors);
                const decoration = getDecorationObject(rule.lineEndingRange, contentText, hoverMessage);
    
                return decoration;
            } catch(err) {
                if (err.name === 'MissingESLintError' || err.name === 'UnsupportedESLintError') {
                    throw err;
                }

                // TODO: what should I do with rule decoration errors?
                return null;
            }
        });

        editor.setDecorations(annotationDecoration, decorations);
        validationCollection.set(editor.document.uri, validationErrors);
    } catch (err) {
        if (err.name === 'MissingESLintError' || err.name === 'UnsupportedESLintError') {
            window.showErrorMessage(err.message);
        }

        // TODO: what should I do with all other errors?
        return;
    }
}

function getContentText(rule, ruleInfo, ruleHasValidationErrors) {
    let contentText = '';

    if (ruleHasValidationErrors === true) {
        contentText += `${glyphs.redXIcon} `;
    }

    if (rule.duplicate === true) {
        contentText += `${glyphs.circledTwo} `;
    }

    if (ruleInfo.isPluginMissing) {
        contentText += `${glyphs.emptyIcon} Missing: \`${ruleInfo.pluginPackageName}\``;
    } else if (!ruleInfo.isRuleFound) {
        contentText += `${glyphs.magnifyIcon} Rule not found`;
    } else {
        if (ruleInfo.isRecommended === true) {
            contentText += `${glyphs.thumbsUpIcon} `;
        }

        if (ruleInfo.isDeprecated === true) {
            contentText += `${glyphs.NoEntryIcon} `;
        }

        if (ruleInfo.isFixable === true) {
            contentText += `${glyphs.wrenchIcon} `;
        }

        if (ruleInfo.type || ruleInfo.category) {
            const categoryText = `[${ruleInfo.type ?? ruleInfo.category}${ruleInfo.type && ruleInfo.category ? ` (${ruleInfo.category})` : ''}]`;
            contentText += `${categoryText}:  `;
        }

        if (ruleInfo.description) {
            contentText += ruleInfo.description;
        } else {
            contentText += `eslint rule: ${ruleInfo.ruleName}`;
        }
    }

    return ` ${glyphs.dot} ${glyphs.dot} ${glyphs.dot} ${contentText}`;
}

function getHoverMessage(rule, ruleInfo, ruleHasValidationErrors) {
    let hoverMessage;
    if (ruleInfo.isPluginMissing) {
        hoverMessage = `**Missing plugin**: \`${ruleInfo.pluginName}\`\n`;

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.circledTwo}&nbsp;&nbsp;*${messages.duplicateRule}*\n`;
        }
    } else if (!ruleInfo.isRuleFound) {
        hoverMessage = `**Rule not found**: \`${ruleInfo.ruleName}\`\n`;

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.circledTwo}&nbsp;&nbsp;*${messages.duplicateRule}*\n`;
        }

        if (ruleInfo.suggestedRules && ruleInfo.suggestedRules.length > 0) {
            ruleInfo.suggestedRules.slice(0, 3).forEach(item => {
                let cmd = createReplaceTextCommand(item, rule.keyRange, item, `Click to replace rule with ${item}`);
                hoverMessage += `&nbsp;&nbsp;${glyphs.lightbulbIcon}&nbsp;&nbsp;did you mean ${cmd}\n`;
            });
        }
    } else {
        hoverMessage = createOpenWebViewPanelCommand(`**${ruleInfo.ruleName}**`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - ${extensionName}`);

        if (ruleInfo.type || ruleInfo.category) {
            const categoryText = `[${ruleInfo.type ?? ruleInfo.category}${ruleInfo.type && ruleInfo.category ? ` (${ruleInfo.category})` : ''}]`;
            hoverMessage += `&nbsp;&nbsp;&nbsp;\\${categoryText}`;
        }
        hoverMessage += '\n';

        if (ruleHasValidationErrors === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.redXIcon}&nbsp;&nbsp;***${messages.validationError}***\n`;
        }

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.circledTwo}&nbsp;&nbsp;*${messages.duplicateRule}*\n`;
        }

        if (ruleInfo.isRecommended === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.thumbsUpIcon}&nbsp;&nbsp;recommended\n`;
        }

        if (ruleInfo.isFixable === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.wrenchIcon}&nbsp;&nbsp;fixable\n`;
        }

        if (ruleInfo.isDeprecated === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.NoEntryIcon}&nbsp;&nbsp;deprecated\n`;
        }

        if (ruleInfo.replacedBy && ruleInfo.replacedBy.length > 0) {
            let replacedByRules = ruleInfo.replacedBy.map(item => {
                return createReplaceTextCommand(item, rule.keyRange, item, `Click to replace rule with ${item}`);
            });
            hoverMessage += `&nbsp;&nbsp;${glyphs.lightbulbIcon}&nbsp;&nbsp;replaced by ${replacedByRules.join(', ')}\n`;
        }

        if (ruleInfo.description) {
            hoverMessage += `\n---\n`;

            hoverMessage += `${ruleInfo.description}\n`;
        }

        hoverMessage = hoverMessage.replace(/\n/g, '  \n');

        if (ruleInfo.schemaDocumentation) {
            hoverMessage += `\n---\n`;
            hoverMessage += '**Rule Options**:\n\n';

            // A code block (\\\ <language> , followed by the code, then another line with \\\) with the lintlens language
            hoverMessage += `\n\`\`\`lintlens\n`;

            const documentation = ruleInfo.schemaDocumentation.replaceAll('\n', `${getSpaces(3)}\n`);
            hoverMessage += `${documentation}\n`;

            hoverMessage += `\n\n\`\`\`\n`;
        }
    }

    hoverMessage += `\n---\n`;
    hoverMessage += createOpenWebViewPanelCommand(`Click for more information`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - ${extensionName}`);

    let markdown = new MarkdownString(hoverMessage);
    markdown.isTrusted = true;

    return markdown;
}

function getSpaces(count) {
    return ' '.repeat(count);
}

function createReplaceTextCommand(commandText, range, newText, tooltip = '') {
    let args = [
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character,
        newText
    ];

    return `[${commandText}](command:${commands.replaceText}?${encodeURIComponent(JSON.stringify(args))} "${tooltip || 'Replace text'}")`;
}

function createOpenWebViewPanelCommand(text, url, title) {
    let args = {
        url,
        title
    };

    let textLink = `[${text}](command:${commands.openWebViewPanel}?${encodeURIComponent(JSON.stringify(args))} "Open in VSCode (may be resource intensive)")`;
    let glyphLink = `[\\\[${glyphs.arrowIcon}\\\]](command:${commands.openInBrowser}?${encodeURIComponent(JSON.stringify(url))} "Open in browser")`;

    return `${textLink}&nbsp;&nbsp;${glyphLink}`;
}

function getDecorationObject(range, contentText, hoverMessage) {
    return {
        range,
        hoverMessage,
        rangeBehavior: DecorationRangeBehavior.ClosedOpen,
        renderOptions: {
            after: {
                color: new ThemeColor('lintlens.annotationColor'),
                fontWeight: 'normal',
                fontStyle: 'normal',
                textDecoration: 'none',
                margin: '0',
                contentText
            }
        }
    };
}
