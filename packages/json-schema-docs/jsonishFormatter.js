const indentSize = 2;
let currentIndentCount = 0; // TODO: not threadsafe (is that ok?)


function indent() {
    currentIndentCount++;
}
function outdent() {
    currentIndentCount--;
}
function getIndent() {
    return ' '.repeat(indentSize * currentIndentCount);
}

// TODO: include deprecated flag
// TODO: include annotations (title, description, maybe examples)
// TODO: consider changing comments starter from # to //


// TODO: do I support passing of state object?

/*
Rules for functions:
    * never start with a newline
    * never start with an indent
    * never end with a newline
    * when a newline is used within, insert indent
*/


export function any(doc, formatFunc) {
    return 'any';
}

export function not(doc, formatFunc) {
    return '';
}

export function nullvalue(doc, formatFunc) {
    return 'null';
}

export function object(doc, formatFunc) {
    let ret = '{\n';

    indent();

    ret += doc.properties.map(property => {
        const prop = `${property.required ? '(required) ' : ''}"${property.key}": ${formatFunc(property.value)}`;
        return `${getIndent()}${prop}`;
    }).join(',\n');

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}# ${message}`;
        }).join('\n');
    }

    outdent();

    ret += `\n${getIndent()}}`;

    return ret;
}

export function tuple(doc, formatFunc) {
    let ret = '[\n';

    indent();

    ret += doc.items.map(item => {
        const val = formatFunc(item);
        return `${getIndent()}${val}`;
    }).join(',\n');

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}# ${message}`;
        }).join('\n');
    }

    outdent();

    ret += `\n${getIndent()}]`;

    return ret;
}

export function array(doc, formatFunc) {
    // simple plain array
    if (!doc.schema && (!doc.requirements || doc.requirements.length === 0)) {
        return '[]';
    }

    let ret = '[\n';

    indent();

    ret += `${getIndent()}${formatFunc(doc.schema)}`;

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}# ${message}`;
        }).join('\n');
    }

    outdent();

    ret += `\n${getIndent()}]`;

    // TODO: consider basing this on doc.schema rather than the whole thing
    //  THOUGHT: then I could have `string[], # min items: 3, unique`

    // simple array of a type (simple, no requirements/annotations)
    //  TODO: can I use doc.schema.schemaType somehow?
    // TODO: should I allow a little bit more? (EX: string (length >= 0)[] )
    const regex = /\[\n\s+(\w+)\n\s+\]/;
    const matches = ret.match(regex);
    if (matches) {
        ret = `${matches[1]}[]`;
    }

    return ret;
}

export function enumeration(doc, formatFunc) {
    let ret = doc.items.map(item => getConstantText(item)).join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function constant(doc, formatFunc) {
    return getConstantText(doc.value);
}

export function string(doc, formatFunc) {
    let ret = 'string';

    if (doc.requirements !==undefined || doc.default !== undefined) {
        const mods = Object.values(doc.requirements).map(req => req.message);

        if (doc.default !== undefined) {
            mods.push(`default: ${doc.default}`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function numeric(doc, formatFunc) {
    let ret = doc.numericType;

    if (doc.requirements !==undefined || doc.default !== undefined) {
        const mods = Object.values(doc.requirements).map(req => req.message);

        if (doc.default !== undefined) {
            mods.push(`default: ${doc.default}`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function boolean(doc, formatFunc) {
    let ret = 'boolean';

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

// TODO: should I do something different for anyOf vs oneOf?
export function anyOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function oneOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function allOf(doc, formatFunc) {
    // TODO: allOf formatter
    return doc.items.map(item => formatFunc(item)).join(' & ');
}

export function ifThenElse(doc, formatFunc) {
    let ret = `if (${formatFunc(doc.if)})`;

    indent();

    ret += `\n${getIndent()}then ${formatFunc(doc.then)})`;

    if (doc.else !== undefined) {
        ret += `\n${getIndent()}else ${formatFunc(doc.else)})`;
    }

    outdent();

    return ret;
}

export function multiType(doc, formatFunc) {
    let ret = doc.types.join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

function getConstantText(text) {
    if (typeof text === 'string') {
        return `"${text}"`;
    }

    return text;
}
