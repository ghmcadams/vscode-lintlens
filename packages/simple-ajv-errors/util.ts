import type { VerboseErrorObject, Schema, JSONSchemaObject } from './types';

import * as levenshtein from 'damerau-levenshtein';


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

export function getDataReferencePath(rootVar: string, path: string): string {
    const pointer = `${rootVar}${path}`;
    return pointer
        // Array items
        .replace(/\/(\d+)/g, '[$1]')
        // Object properties
        .replace(/\/(\w+)/g, '.$1');
}

export function getOfChoiceIndex(parent: unknown[], schemaPath: string) {
    let choiceIndex: number = parent.length;
    const thisSchemaParts = schemaPath.split('/');
    for (let i = thisSchemaParts.length - 2; i > 0; i--) {
        if (ofErrorKeywords.includes(thisSchemaParts[i])) {
            choiceIndex = parseInt(thisSchemaParts[i + 1], 10);
            break;
        }
    }

    return choiceIndex;
}

export function getValueMatchScore(data: unknown, valuesToCheck: unknown) {
    const valuesArray = Array.isArray(valuesToCheck) ? valuesToCheck : [valuesToCheck];
    return Math.max(...valuesArray.map(value => {
        if (data === value) {
            return 1;
        }
        if (getType(data) !== 'string' || getType(value) !== 'string') {
            return 0;
        }

        const lev = levenshtein(data as string, value as string);
        return lev.similarity;
    }));
}

export function getPropertyMatchScore(data: JSONSchemaObject, schema: Schema) {
    const schemaTypes = getSchemaType(schema);
    if (!schemaTypes.includes('object')) {
        return 0;
    }

    const dataProperties = Object.keys(data);

    const matchScore = dataProperties.reduce((ret, dataKey) => {
        const dataType = getType(data[dataKey]);
        const schemaPropertyNames = schema.properties !== undefined ? Object.keys(schema.properties) : [];
        if (schemaPropertyNames.includes(dataKey)) {
            const schemaPropertyTypes = schema.properties !== undefined ? getSchemaType(schema.properties[dataKey]) : [];
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

export function areErrorsEqual(error1: VerboseErrorObject, error2: VerboseErrorObject) {
    return (
        error1.instancePath === error2.instancePath &&
        error1.keyword === error2.keyword &&
        JSON.stringify(error1.params) === JSON.stringify(error2.params)
    );
}

export function getType(variable: unknown) {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
}
export function isArray<T>(variable: unknown): variable is Array<T> {
    return getType(variable) === 'array';
}

export function getSchemaType(entry: Schema | boolean) {
    if (typeof entry === 'boolean') {
        return ['boolean'];
    }

    if (entry.hasOwnProperty('enum') && entry.enum !== undefined) {
        return entry.enum.map(getType);
    }
    if (entry.hasOwnProperty('const') && entry.const !== undefined) {
        return [getType(entry.const)];
    }

    if (!entry.hasOwnProperty('type') || entry.type === undefined) {
        // INVALID schema: determine type based on other properties
        if (entry.hasOwnProperty('items')) {
            return ['array'];
        }
    }

    if (typeof entry.type === 'string') {
        const theType = schemaTypeMap[entry.type] ?? entry.type;
        return [theType];
    }

    return ['null'];
}

const schemaTypeMap: Record<string, string> = {
    integer: 'number'
};

export function getCommonPrefix(string1: string, string2: string) {
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
