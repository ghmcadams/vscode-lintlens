import levenshtein from 'damerau-levenshtein';


export const ofErrorKeywords = ['anyOf', 'oneOf'];

// Add parents if one of these keywords
export const parentKeywordsOk = [
    'minItems',
    'maxItems',
    'additionalItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'additionalProperties',
    'required',
    'contains',
    'dependencies',
    'propertyNames',
    'unevaluatedProperties',
    'unevaluatedItems',
    'dependentRequired',
];

export function getDataReferencePath(rootVar, path) {
    const pointer = `${rootVar}${path}`;
    return pointer
        // Array items
        .replace(/\/(\d+)/g, '[$1]')
        // Object properties
        .replace(/\/(\w+)/g, '.$1');
}

export function getOfChoiceIndex(parent, schemaPath) {
    let choiceIndex = parent.length;
    const thisSchemaParts = schemaPath.split('/');
    for (let i = thisSchemaParts.length - 2; i > 0; i--) {
        if (ofErrorKeywords.includes(thisSchemaParts[i])) {
            choiceIndex = parseInt(thisSchemaParts[i + 1], 10);
            break;
        }
    }

    return choiceIndex;
}

export function getValueMatchScore(data, valuesToCheck) {
    const valuesArray = Array.isArray(valuesToCheck) ? valuesToCheck : [valuesToCheck];
    return Math.max(...valuesArray.map(value => {
        if (data === value) {
            return 1;
        }
        if (getType(data) !== 'string' || getType(value) !== 'string') {
            return 0;
        }

        const lev = levenshtein(data, value);
        return lev.similarity;
    }));
}

export function getPropertyMatchScore(data, schema) {
    const schemaTypes = getSchemaType(schema);
    if (!schemaTypes.includes('object')) {
        return 0;
    }

    const dataProperties = Object.keys(data);

    const matchScore = dataProperties.reduce((ret, dataKey) => {
        const dataType = getType(data[dataKey]);
        const schemaPropertyNames = Object.keys(schema.properties);
        if (schemaPropertyNames.includes(dataKey)) {
            const schemaPropertyTypes = getSchemaType(schema.properties[dataKey]);
            ret += schemaPropertyTypes.includes(dataType) ? 1 : 0;
        } else {
            // Get the score for the schema property that most closely matches the data property
            const keyScore = schemaPropertyNames.reduce((val, key) => {
                const lev = levenshtein(dataKey, key);
                return Math.max(val, lev.similarity);
            }, 0);

            // A score less than 0.7 is not a close enough match
            ret += keyScore > 0.7 ? keyScore : 0;
        }
        return ret;
    }, 0);

    return matchScore / dataProperties.length;
}

export function areErrorsEqual(error1, error2) {
    return (
        error1.instancePath === error2.instancePath &&
        error1.keyword === error2.keyword &&
        JSON.stringify(error1.params) === JSON.stringify(error2.params)
    );
}

export function getType(variable) {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
}

export function getSchemaType(entry = {}) {
    if (entry.hasOwnProperty('enum')) {
        return entry.enum.map(getType);
    }
    if (entry.hasOwnProperty('const')) {
        return [getType(entry.const)];
    }

    if (!entry.hasOwnProperty('type')) {
        // INVALID schema: determine type based on other properties
        if (entry.hasOwnProperty('items')) {
            return ['array'];
        }
    }

    return [schemaTypeMap[entry.type] ?? entry.type];
}

const schemaTypeMap = {
    integer: 'number'
};

export function getCommonPrefix(string1, string2) {
    let sharedPrefix = '';
    for (let i = 0; i < string1.length && i < string2.length; i++) {
        if (string1[i] === string2[i]) {
            sharedPrefix += string1[i];
        } else {
            break;
        }
    }

    return sharedPrefix;
}
