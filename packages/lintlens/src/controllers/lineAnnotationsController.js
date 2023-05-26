import { window, workspace, languages, Range, MarkdownString, DecorationRangeBehavior, ThemeColor, DiagnosticSeverity } from 'vscode';
import { getParser } from '../parsers/DocumentParser';
import { getRuleDetails } from '../rules';
import { glyphs, extensionName, commands, messages } from '../constants';
import { validateConfigFromSchema } from '../schema';

const annotationDecoration = window.createTextEditorDecorationType({});
const diagnosticsCollection = languages.createDiagnosticCollection('validation');

export function initialize(context) {
    let activeEditor = window.activeTextEditor;

    // generate when document is made active
    window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            addAnnotations(editor, context);
        }
	}, null, context.subscriptions);

    // generate when the document is edited
    workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
            addAnnotations(activeEditor, context);
		}
	}, null, context.subscriptions);

    // generate on start
	if (activeEditor) {
		addAnnotations(activeEditor, context);
	}
}

function clearAnnotations(editor) {
    if (editor === undefined || editor._disposed === true) {
        return;
    }
    editor.setDecorations(annotationDecoration, []);
    diagnosticsCollection.clear();
}

function addAnnotations(editor, context) {
    if (editor === undefined || editor._disposed === true || editor.document === undefined) {
        return;
    }

    const parser = getParser(editor.document);
    if (!parser) {
        return;
    }

    const rules = parser.getRules();
    if (rules.length === 0) {
        return clearAnnotations(editor);
    }

    try {
        const diagnostics = [];
        const decorations = [];

        rules.forEach(rule => {
            try {
                const ruleInfo = getRuleDetails(editor.document.fileName, rule.name);
                if (ruleInfo === null) {
                    return;
                }

                // validate rule config options
                ruleInfo.validationErrors = [];
                if (rule.configuration?.value !== null && rule.configuration?.value !== undefined) {
                    const { severity, options } = validateConfigFromSchema(ruleInfo.schema, rule.configuration.value);
                    if (!severity.valid) {
                        ruleInfo.validationErrors.push(...severity.errors);

                        diagnostics.push(...severity.errors.map(error => ({
                            source: 'LintLens',
                            range: rule.configuration.severityRange,
                            severity: DiagnosticSeverity.Error,
                            message: error,
                        })));
                    }
                    if (!options.valid) {
                        const errorMessages = options.errors.map(error => error.message);
                        ruleInfo.validationErrors.push(...errorMessages);

                        diagnostics.push(...errorMessages.map(error => ({
                            source: 'LintLens',
                            range: rule.configuration.optionsRange,
                            severity: DiagnosticSeverity.Error,
                            message: error,
                        })));
                    }
                }

                // add diagnostics as needed
                if (ruleInfo.isPluginMissing) {
                    diagnostics.push({
                        source: 'LintLens',
                        range: rule.key.range,
                        severity: DiagnosticSeverity.Error,
                        message: `Plugin missing "${ruleInfo.pluginPackageName}"`,
                    });
                } else if (!ruleInfo.isRuleFound) {
                    diagnostics.push({
                        source: 'LintLens',
                        range: rule.key.range,
                        severity: DiagnosticSeverity.Error,
                        message: `Rule "${rule.name}" not found`,
                    });
                }
                if (rule.duplicate) {
                    diagnostics.push({
                        source: 'LintLens',
                        range: rule.key.range,
                        severity: DiagnosticSeverity.Warning,
                        message: messages.duplicateRule,
                    });
                }
                if (ruleInfo.isDeprecated) {
                    diagnostics.push({
                        source: 'LintLens',
                        range: rule.key.range,
                        severity: DiagnosticSeverity.Warning,
                        message: `Rule "${rule.name}" is deprecated`,
                    });
                }

                // Create annotation decoration
                const contentText = getContentText(rule, ruleInfo);
                const hoverMessage = getHoverMessage(rule, ruleInfo);

                const lineEndingRange = new Range(rule.key.range.start.line, Number.MAX_SAFE_INTEGER, rule.key.range.start.line, Number.MAX_SAFE_INTEGER);
                const decoration = getDecorationObject(lineEndingRange, contentText, hoverMessage);

                decorations.push(decoration);
            } catch(err) {
                if (err.name === 'MissingESLintError' || err.name === 'UnsupportedESLintError') {
                    throw err;
                }

                // TODO: what should I do with rule decoration errors?
            }
        });

        editor.setDecorations(annotationDecoration, decorations);
        diagnosticsCollection.set(editor.document.uri, diagnostics);
    } catch (err) {
        if (err.name === 'MissingESLintError' || err.name === 'UnsupportedESLintError') {
            window.showErrorMessage(err.message);
        }

        // TODO: what should I do with all other errors?
        return;
    }
}

function getContentText(rule, ruleInfo) {
    let contentText = '';

    if (ruleInfo.validationErrors?.length > 0) {
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
            contentText += `${glyphs.checkmark} `;
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

function getHoverMessage(rule, ruleInfo) {
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
                const cmd = createReplaceTextCommand(item, rule.key.range, item, `Click to replace rule with ${item}`);
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

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.circledTwo}&nbsp;&nbsp;*${messages.duplicateRule}*\n`;
        }

        if (ruleInfo.isRecommended === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.checkmark}&nbsp;&nbsp;recommended\n`;
        }

        if (ruleInfo.isFixable === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.wrenchIcon}&nbsp;&nbsp;fixable\n`;
        }

        if (ruleInfo.isDeprecated === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.NoEntryIcon}&nbsp;&nbsp;deprecated\n`;
        }

        if (ruleInfo.replacedBy && ruleInfo.replacedBy.length > 0) {
            const replacedByRules = ruleInfo.replacedBy.map(item => {
                return createReplaceTextCommand(item, rule.key.range, item, `Click to replace rule with ${item}`);
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

            if (ruleInfo.validationErrors?.length > 0) {
                hoverMessage += `${glyphs.redXIcon}&nbsp;&nbsp;***${messages.validationError}***\n\n`;
            }

            hoverMessage += '**Rule Options**:\n\n';

            // A code block (\\\ <language> , followed by the code, then another line with \\\) with the lintlens language
            hoverMessage += `\n\`\`\`lintlens\n`;

            const documentation = ruleInfo.schemaDocumentation.replaceAll('\n', `${getSpaces(3)}\n`);
            hoverMessage += `${documentation}\n`;

            hoverMessage += `\n\n\`\`\`\n`;
        }
    }

    if (ruleInfo.validationErrors?.length > 0) {
        hoverMessage += `\n---\n`;

        hoverMessage += `${glyphs.redXIcon} **Validation Errors**:\n`;

        ruleInfo.validationErrors.forEach(error => {
            hoverMessage += `> ${error}  \n`;
        });
    }

    hoverMessage += `\n---\n`;
    hoverMessage += createOpenWebViewPanelCommand(`Click for more information`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - ${extensionName}`);

    const markdown = new MarkdownString(hoverMessage);
    markdown.isTrusted = true;

    return markdown;
}

function getSpaces(count) {
    return ' '.repeat(count);
}

function createReplaceTextCommand(commandText, range, newText, tooltip = '') {
    const args = [
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character,
        newText
    ];

    return `[${commandText}](command:${commands.replaceText}?${encodeURIComponent(JSON.stringify(args))} "${tooltip || 'Replace text'}")`;
}

function createOpenWebViewPanelCommand(text, url, title) {
    const args = {
        url,
        title
    };

    const textLink = `[${text}](command:${commands.openWebViewPanel}?${encodeURIComponent(JSON.stringify(args))} "Open in VSCode (may be resource intensive)")`;
    const glyphLink = `[\\\[${glyphs.arrowIcon}\\\]](command:${commands.openInBrowser}?${encodeURIComponent(JSON.stringify(url))} "Open in browser")`;

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
