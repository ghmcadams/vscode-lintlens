const indentSize = 2;


function indent(state) {
    state.currentIndentCount++;
}
function outdent(state) {
    state.currentIndentCount--;
}
function getIndent(state) {
    return ' '.repeat(indentSize * state.currentIndentCount);
}


// TODO: include deprecated flag
// TODO: include annotations (title, description, maybe examples)
// IMPORTANT THOUGHT:  not sure how to display these - object vs object param's value, array vs array item, numeric, etc.
    // if (doc.deprecated === true) {
    //     ret += `${getIndent(state)}// deprecated\n`;
    // }
    // // annotations (just description for now)
    // if (doc.annotations?.description !== undefined) {
    //     ret += `${getIndent(state)}// ${doc.annotations.description}\n`;
    // }

// TODO: consider moving requirements (in arrays & objects) to the top

/*
Rules for functions:
    * never start with a newline
    * never start with an indent
    * never end with a newline
    * when a newline is used within, insert indent
    * when children are added, increase indent before and decrease after
*/


export function getInitialState() {
    return {
        currentIndentCount: 0,
    };
}

export function externalRef(doc, formatFunc, state) {
    return `<Unknown: external schema (${doc.baseUri}${doc.baseUri.endsWith('/') ? '' : '/'}${doc.reference})>`;
}

export function empty(doc, formatFunc, state) {
    return '';
}

export function any(doc, formatFunc, state) {
    return 'any';
}

export function not(doc, formatFunc, state) {
    // TODO: NOT formatter
    return `! ${formatFunc(doc.schema)}`;
}

export function nullvalue(doc, formatFunc, state) {
    return 'null';
}

export function object(doc, formatFunc, state) {
    let ret = '{\n';

    indent(state);

    let innards = '';
    const props = [];

    props.push(...doc.properties.map(property => {
        const prop = `${property.required ? '(required) ' : ''}"${property.key}": ${formatFunc(property.value)}`;
        return `${getIndent(state)}${prop}`;
    }));

    if (doc.indexProperties) {
        props.push(...doc.indexProperties.map(property => {
            const prop = `${property.required ? '(required) ' : ''}${property.key}: ${formatFunc(property.value)}`;
            return `${getIndent(state)}${prop}`;
        }));
    }

    innards += props.join(',\n');

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        if (innards !== '') {
            innards += '\n';
        }
        innards += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }).join('\n');
    }

    if (innards !== '') {
        ret += innards;
    } else {
        ret += `${getIndent(state)}[string]: any`;
    }

    outdent(state);

    ret += `\n${getIndent(state)}}`;

    return ret;
}

export function tuple(doc, formatFunc, state) {
    let ret = '[\n';

    indent(state);

    ret += doc.items.map(item => {
        const val = formatFunc(item);
        return `${getIndent(state)}${val}`;
    }).join(',\n');

    if (doc.additionalItems !== undefined) {
        if (doc.items) {
            ret += ',\n';
        }
        ret += `${getIndent(state)}...${formatFunc(doc.additionalItems)}`;
    }

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        if (doc.items || doc.additionalItems) {
            ret += '\n';
        }
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }).join('\n');
    }

    outdent(state);

    ret += `\n${getIndent(state)}]`;

    return ret;
}

export function array(doc, formatFunc, state) {
    // simple plain array
    if (!doc.schema && (!doc.requirements || Object.keys(doc.requirements).length === 0)) {
        return 'any[]';
    }

    let ret = '[\n';

    indent(state);

    ret += `${getIndent(state)}${formatFunc(doc.schema)}`;

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }).join('\n');
    }

    outdent(state);

    ret += `\n${getIndent(state)}]`;

    // TODO: consider basing simple arrays on doc.schema rather than the whole thing
    //  THOUGHT: then I could have `string[], // min items: 3, unique`

    // TODO: handle empty array

    // simple array of a type (simple, no requirements/annotations)
    const regex = /\[\n\s+(\w+)?\n\s+\]/;
    const matches = ret.match(regex);
    if (matches) {
        ret = `${matches[1] ?? ''}[]`;
    }

    return ret;
}

export function enumeration(doc, formatFunc, state) {
    let ret = doc.items.map(item => getConstantText(item)).join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${getConstantText(doc.default)})`;
    }

    return ret;
}

export function constant(doc, formatFunc, state) {
    return getConstantText(doc.value);
}

export function string(doc, formatFunc, state) {
    let ret = 'string';

    if (doc.requirements !== undefined || doc.default !== undefined) {
        const mods = [];

        if (doc.requirements !== undefined) {
            mods.push(...Object.values(doc.requirements).map(req => req.message));
        }

        if (doc.default !== undefined) {
            mods.push(`default: "${doc.default}"`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function numeric(doc, formatFunc, state) {
    let ret = doc.numericType;

    if (doc.requirements !==undefined || doc.default !== undefined) {
        const mods = [];

        if (doc.requirements !== undefined) {
            mods.push(...Object.values(doc.requirements).map(req => req.message));
        }

        if (doc.default !== undefined) {
            mods.push(`default: ${doc.default}`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function boolean(doc, formatFunc, state) {
    let ret = 'boolean';

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function anyOf(doc, formatFunc, state) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function oneOf(doc, formatFunc, state) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function allOf(doc, formatFunc, state) {
    return doc.items.map(item => formatFunc(item)).join(' & ');
}

export function ifThenElse(doc, formatFunc, state) {
    let ret = `if (${formatFunc(doc.if)})`;

    indent(state);

    if (doc.then !== undefined) {
        ret += `\n${getIndent(state)}then ${formatFunc(doc.then)})`;
    }

    if (doc.else !== undefined) {
        ret += `\n${getIndent(state)}else ${formatFunc(doc.else)})`;
    }

    outdent(state);

    return ret;
}

export function multiType(doc, formatFunc, state) {
    let ret = doc.types.join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function invalid(doc, formatFunc, state) {
    return '<Unknown: invalid schema>';
}

function getConstantText(text) {
    if (typeof text === 'string') {
        return `"${text}"`;
    }

    return text;
}
