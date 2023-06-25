const indentSize = 2;
let currentIndentCount = 0;


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
    // if (doc.deprecated === true) {
    //     innards += `${getIndent()}// deprecated\n`;
    // }
    // // annotations (just description for now)
    // if (doc.annotations?.description !== undefined) {
    //     innards += `${getIndent()}// ${doc.annotations.description}\n`;
    // }

// TODO: consider moving requirements (in arrays & objects) to the top

// TODO: do I support passing of state object?
//      this would solve the indent problem (indent doesn't clear on error - when moving to the next schema)

/*
Rules for functions:
    * never start with a newline
    * never start with an indent
    * never end with a newline
    * when a newline is used within, insert indent
    * when children are added, increase indent before and decrease after
*/


export function empty(doc, formatFunc) {
    return '';
}

export function any(doc, formatFunc) {
    return 'any';
}

export function not(doc, formatFunc) {
    // TODO: NOT formatter

    return '';

    // return `! ${formatFunc(item)}`;
}

export function nullvalue(doc, formatFunc) {
    return 'null';
}

export function object(doc, formatFunc) {
    let ret = '{\n';

    indent();

    let innards = '';
    const props = [];

    props.push(...doc.properties.map(property => {
        const prop = `${property.required ? '(required) ' : ''}"${property.key}": ${formatFunc(property.value)}`;
        return `${getIndent()}${prop}`;
    }));

    if (doc.indexProperties) {
        props.push(...doc.indexProperties.map(property => {
            const prop = `${property.required ? '(required) ' : ''}${property.key}: ${formatFunc(property.value)}`;
            return `${getIndent()}${prop}`;
        }));
    }

    innards += props.join(',\n');

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        innards += '\n';
        innards += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}// ${message}`;
        }).join('\n');
    }

    if (innards !== '') {
        ret += innards;
    } else {
        ret += `${getIndent()}[any]: any`;
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

    // TODO: handle additionalItems in tuple
    //   what if additionalItems is an array?

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}// ${message}`;
        }).join('\n');
    }

    outdent();

    ret += `\n${getIndent()}]`;

    return ret;
}

export function array(doc, formatFunc) {
    // simple plain array
    if (!doc.schema && (!doc.requirements || Object.keys(doc.requirements).length === 0)) {
        return 'any[]';
    }

    let ret = '[\n';

    indent();

    ret += `${getIndent()}${formatFunc(doc.schema)}`;

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += '\n';
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent()}// ${message}`;
        }).join('\n');
    }

    outdent();

    ret += `\n${getIndent()}]`;

    // TODO: consider basing this on doc.schema rather than the whole thing
    //  THOUGHT: then I could have `string[], // min items: 3, unique`

    // simple array of a type (simple, no requirements/annotations)
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
        ret += ` (default: ${getConstantText(doc.default)})`;
    }

    return ret;
}

export function constant(doc, formatFunc) {
    return getConstantText(doc.value);
}

export function string(doc, formatFunc) {
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

export function numeric(doc, formatFunc) {
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

export function boolean(doc, formatFunc) {
    let ret = 'boolean';

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function anyOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function oneOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function allOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' & ');
}

export function ifThenElse(doc, formatFunc) {
    let ret = `if (${formatFunc(doc.if)})`;

    indent();

    if (doc.then !== undefined) {
        ret += `\n${getIndent()}then ${formatFunc(doc.then)})`;
    }

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

export function invalid(doc, formatFunc) {
    return '<Unknown: invalid schema>';
}

function getConstantText(text) {
    if (typeof text === 'string') {
        return `"${text}"`;
    }

    return text;
}
