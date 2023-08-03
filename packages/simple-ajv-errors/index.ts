import type {
    SparseArray,
    SchemaArray,
    VerboseErrorObject,
    OfErrorObject,
    AnyError,
    OfErrorObjectForObject,
    OfErrorObjectForArray,
    OfErrorObjectWithPath,
    JSONSchemaObject,
    Schema,
} from './types';

import * as clone from 'clone';
import * as pluralize from 'pluralize';

import {
    ofErrorKeywords,
    parentKeywordsOk,
    areErrorsEqual,
    getCommonPrefix,
    getDataReferencePath,
    getOfChoiceIndex,
    getPropertyMatchScore,
    getSchemaType,
    getType,
    getValueMatchScore,
} from './util';


type Options = {
    rootVar?: string;
};

type SimpleError = {
    message: string;
    instancePath: string;
    schemaPath: string;
    schema?: any;
    parentSchema?: object;
    data?: any;
};


// TODO: change the options type to include an option to return a single string for all errors, with a separator
//      OR - 
//      add another function, which just calls func().map(message).join(separator)

/**
 * Get usable, human readable, simple error messages from ajv errors.
 * @param {ErrorObject[]} errors - The errors created as a result of calling ajv.validate().
 * @param {object=} options - Configuration options to help give the best result.
 * @param {string} [options.rootVar='data'] - The text to use for the root of the data variable.
 * @return {SimpleError[]} An array of simple errors.
 */
export function getSimpleErrors(errors: VerboseErrorObject[] | null, options: Options = {}): SimpleError[] {
    if (!errors || errors.length === 0) {
        return [];
    }

    const {
        rootVar = 'data',
    } = options;

    const processedErrors = processErrors(errors);

    const simpleErrors = processedErrors.map((error) => {
        const path = getDataReferencePath(rootVar, error.instancePath);
        const errorMessage = getMessageForError(error);
        const message = `${path} must ${errorMessage}`;

        const {
            instancePath,
            schemaPath,
            schema,
            parentSchema,
            data,
        } = error;

        return {
            message,
            instancePath,
            schemaPath,
            schema,
            parentSchema,
            data,
        };
    });

    return simpleErrors;
};

function processErrors(errors: VerboseErrorObject[]) {
    const clonedErrors = clone(errors);

    const ofHierarchy = getOfHierarchy(clonedErrors);
    const processedErrors = filterByChosenPath(ofHierarchy);

    return processedErrors;
}

// TODO: add a comment for what an OF hierarchy is
function getOfHierarchy(errors: VerboseErrorObject[]): AnyError[] {
    const ofs = errors.filter((err) => isOfError(err)) as OfErrorObject[];
    if (ofs.length === 0) {
        return errors;
    }

    replaceSchemaRefs(errors);

    const ret: AnyError[] = [];

    // Loop through non OF errors
    const nonOfErrors = errors.filter((err) => !isOfError(err));
    for (const error of nonOfErrors) {
        const schemaOfs = getSchemaOfs(error);

        let ref: AnyError[] | SparseArray<AnyError[]> = ret;

        for (const schemaPath of schemaOfs) {
            // already stored
            const storedErrors = ref.flat() as AnyError[];
            const refError = storedErrors.find(item => item?.schemaPath === schemaPath);
            if (refError && isOfError(refError)) {
                // TODO: bug: refError may not be an OF (which means it may not have choices)
                //  maybe I thought that non-OF-errors with the same schemaPath could not co-exist?
                ref = refError.choices;
                continue;
            }

            // not yet stored, add it
            const ofError = ofs.find(item => item.schemaPath === schemaPath);
            if (ofError) {
                ofError.choices = [];

                if (ref === ret) {
                    ref.push(ofError);
                } else {
                    const choiceIndex = getOfChoiceIndex(ref, ofError.schemaPath);
                    const choice = (ref[choiceIndex] ?? []) as AnyError[];
                    choice.push(ofError);
                    ref[choiceIndex] = choice;
                }

                ref = ofError.choices;
                continue;
            }

            // OF not found anywhere (not supposed to happen)
            break;
        }

        // TODO: verify that this comment is correct (and maybe improve it)
        // Add current error to the return stack
        if (ref === ret) {
            ref.push(error);
        } else {
            const choiceIndex = getOfChoiceIndex(ref, error.schemaPath);
            const choice = (ref[choiceIndex] ?? []) as AnyError[];
            choice.push(error);
            ref[choiceIndex] = choice;
        }
    }

    return ret;
}

function getSchemaOfs(error: VerboseErrorObject) {
    // get the list of OF schema paths for this error
    const schemaOfs: string[] = [];
    const schemaParts = error.schemaPath.split('/');
    schemaParts.pop(); // Ignore the last element (current error)
    schemaParts.forEach((part, index) => {
        if (ofErrorKeywords.includes(part)) {
            schemaOfs.push(schemaParts.slice(0, index + 1).join('/'));
        }
    });

    return schemaOfs;
}

function replaceSchemaRefs(errors: VerboseErrorObject[]) {
    errors.forEach(error => {
        if (!Array.isArray(error.schema)) {
            return;
        }
        const schema = error.schema;
        schema.forEach((item, index) => {
            const schemaPathReplacement = `${error.schemaPath}/${index}`;

            if (getType(item) === 'object' && item.hasOwnProperty('$ref') && item.$ref != undefined) {
                const ref = item.$ref;
                errors.forEach(otherError => {
                    if (otherError.instancePath === error.instancePath) {
                        otherError.schemaPath = otherError.schemaPath.replace(ref, schemaPathReplacement);

                        if (otherError.schemaPath.slice(schemaPathReplacement.length + 1).includes('/')) {
                            schema[index] = otherError.parentSchema as Schema;
                        }
                    }
                });
            }
        });
    });
}

function filterByChosenPath(ofHierarchy: AnyError[]) {
    const ret: AnyError[] = [];

    for (const error of ofHierarchy) {
        if (isOfError(error)) {
            const chosenPaths = getChosenPaths(error);
            const {
                choices,
                ...ofError
            } = error;

            if (chosenPaths.length === 1) {
                ret.push(...filterByChosenPath(choices[chosenPaths[0]] ?? []));
                continue;
            }
            if (chosenPaths.length > 1) {
                const ofPaths = chosenPaths.map(pathIndex => filterByChosenPath(choices[pathIndex] ?? []));
                const distinctErrors = getDistinctAcrossOfErrors({
                    ...ofError,
                    ofPaths
                });
                ret.push(...distinctErrors);
            }
        } else {
            ret.push(error);
        }
    }

    const lowestErrors = findLowestErrors(ret);
    return lowestErrors;
}

function findLowestErrors(errors: AnyError[]) {
    const tracker = new Map<string, AnyError[]>();

    errors.forEach(error => {
        const existing = tracker.get(error.instancePath);

        if (existing) {
            existing.push(error);
            return;
        }

        // If ancestor exists, replace with current
        const check = error.instancePath.split('/').slice(0, -1);
        while (check.length > 0) {
            const checkKey = check.join('/');
            if (tracker.has(checkKey)) {
                tracker.delete(checkKey);
                tracker.set(error.instancePath, [error]);
                return;
            }
            check.pop();
        }

        // If there are no deeper ones, insert current
        const foundLonger = Array.from(tracker.keys()).some(key => key.startsWith(`${error.instancePath}/`));
        if (!foundLonger) {
            tracker.set(error.instancePath, [error]);
            return;
        }
    });
    const lowestErrors = Array.from(tracker.values()).flat();

    // add ancestors if they are in the allow list
    for (const lowError of lowestErrors.filter(({ instancePath }) => instancePath !== '')) {
        const lastSegment = lowError.instancePath.substring(lowError.instancePath.lastIndexOf('/') + 1);
        const ancestorErrors = errors.filter(error => {
            // already there
            if (lowestErrors.includes(error)) {
                return false;
            }
            // same instancePath
            if (error.instancePath === lowError.instancePath) {
                return false;
            }
            // not ancestor
            if (!lowError.instancePath.startsWith(error.instancePath)) {
                return false;
            }
            // not in the same schemaPath (of choice)
            const sharedPath = getCommonPrefix(lowError.schemaPath, error.schemaPath);
            if (sharedPath.endsWith('Of/')) {
                return false;
            }
            // not valid parent keyword
            if (!parentKeywordsOk.includes(error.keyword)) {
                return false;
            }
            // refers to the same property
            if (error.keyword === 'additionalProperties' && error.params.additionalProperty === lastSegment) {
                return false;
            }

            return true;
        });

        lowestErrors.push(...ancestorErrors);
    }

    lowestErrors.sort((a, b) => a.instancePath.localeCompare(b.instancePath));

    // remove type error when enum one exists
    const enumError = lowestErrors.find(({ keyword }) => keyword === 'enum');
    if (enumError) {
        return lowestErrors.filter(error => error.schemaPath !== enumError.schemaPath.replace(/\/enum$/, '/type'));
    }

    return lowestErrors;
}

function getChosenPaths(error: OfErrorObject) {
    const {
        choices,
        data,
        schema
    } = error;

    const choiceIndices = choices.reduce<number[]>((ret, item, index) => {
        if (item !== undefined) {
            ret.push(index);
        }
        return ret;
    }, []);
    if (choiceIndices.length === 1) {
        return choiceIndices;
    }

    if (schema === undefined) {
        return choiceIndices;
    }

    const allIndices = schema.map((_, index) => index);

    const typeofSchema = getType(schema);
    const typeofData = getType(data);

    if (typeofSchema !== 'array' || typeofData === 'undefined') {
        // unable to determine a path if I cannot inspect data or schema
        return allIndices;
    }

    const indicesTypeMatch = choiceIndices.reduce<number[]>((ret, index) => {
        const entry = schema[index];
        if (entry.hasOwnProperty('enum')) {
            const score = getValueMatchScore(data, entry.enum);
            if (score > 0.7) {
                ret.push(index);
            }
            return ret;
        }
        if (entry.hasOwnProperty('const')) {
            const score = getValueMatchScore(data, entry.const);
            if (score > 0.7) {
                ret.push(index);
            }
            return ret;
        }

        const typesofEntry = getSchemaType(entry);
        if (typesofEntry.includes(typeofData)) {
            ret.push(index);
        }
        return ret;
    }, []);

    if (indicesTypeMatch.length === 0) {
        // Nothing matches type of data (not sure why)
        return allIndices;
    }

    if (indicesTypeMatch.length === 1) {
        // only one matches the type of data, must be the one
        return indicesTypeMatch;
    }

    if (typeofData === 'object') {
        return getChosenPathsWhenObject(error as OfErrorObjectForObject, indicesTypeMatch);
    }
    if (typeofData === 'array') {
        return getChosenPathsWhenArray(error as OfErrorObjectForArray, indicesTypeMatch);
    }

    return indicesTypeMatch;
}

function getChosenPathsWhenObject(error: OfErrorObjectForObject, indices: number[]) {
    if (!indices || indices.length === 0) {
        return indices;
    }

    const {
        data,
        schema
    } = error;

    const indicesWithScore = indices.map(index => {
        const entry = schema[index];
        const matchScore = getPropertyMatchScore(data, entry);
        return [index, matchScore];
    });
    indicesWithScore.sort(([,a], [,b]) => b - a);

    // none have matches
    if (indicesWithScore[0][1] === 0) {
        return indices;
    }

    // return an array with all that have the most
    return indicesWithScore
        .filter(entry => entry[1] === indicesWithScore[0][1])
        .map(entry => entry[0]);
}

function getChosenPathsWhenArray(error: OfErrorObjectForArray, indices: number[]) {
    if (!indices || indices.length === 0) {
        return indices;
    }

    const {
        data,
        schema
    } = error;

    // minItems and maxItems matches data item count
    const dataItemCount = data.length;
    const indicesfromArray = indices.reduce<number[]>((ret, index) => {
        const entry = schema[index];
        const minItems = entry.minItems ?? 0;
        const maxItems = entry.maxItems ?? Number.MAX_SAFE_INTEGER;
        if (dataItemCount >= minItems && dataItemCount <= maxItems) {
            ret.push(index);
        }
        return ret;
    }, []);

    if (indicesfromArray.length === 0) {
        // Nothing matches (not sure why)
        return indices;
    }
    if (indicesfromArray.length === 1) {
        // only one matches, most likely the one
        return indicesfromArray;
    }

    // more than one match found - check details of each schema part
    const indicesfromDetails = indicesfromArray.reduce<number[]>((ret, index) => {
        const entry = schema[index];
        if (!entry.items) {
            return ret;
        }

        if (entry.items === true) {
            return ret;
        }

        let items = entry.items;
        let isTuple = true;

        if (!Array.isArray(items)) {
            isTuple = false;

            if (items.hasOwnProperty('anyOf') && items.anyOf !== undefined) {
                items = items.anyOf;
            } else if (items.hasOwnProperty('oneOf') && items.oneOf !== undefined) {
                items = items.oneOf;
            } else {
                items = [items];
            }
        }

        const itemsArray = items as SchemaArray;

        data.forEach((dataItem, dataIndex) => {
            // if it is a tuple, then the length must match
            // allowing less than for in progress scenarios
            if (isTuple && data.length > itemsArray.length) {
                return;
            }

            const dataItemType = getType(dataItem);

            const itemsForThisIndex = isTuple ? [itemsArray[dataIndex]] : itemsArray;
            const anyMatch = itemsForThisIndex.some(item => {
                const itemTypes = getSchemaType(item);

                if (!itemTypes.includes(dataItemType)) {
                    return false;
                }

                // if it matches any of the enum values, return true
                if (item.hasOwnProperty('enum') && item.enum !== undefined) {
                    if (item.enum.includes(dataItem)) {
                        return true;
                    }
                }

                // if it matches the const value, return true
                if (item.hasOwnProperty('const') && item.const !== undefined) {
                    if (item.const === dataItem) {
                        return true;
                    }
                }

                if (dataItemType === 'object') {
                    // TODO: static score is less meaningful - need to compare with others
                    const matchScore = getPropertyMatchScore(dataItem as JSONSchemaObject, item);
                    if (matchScore > 0.5) {
                        return true;
                    }
                }

                return false;
            });
            if (anyMatch) {
                ret.push(index);
            }
        });

        return ret;
    }, []);
    if (indicesfromDetails.length === 0) {
        // Nothing matches (not sure why)
        return indices;
    }
    if (indicesfromDetails.length === 1) {
        // only one matches, most likely the one
        return indicesfromDetails;
    }

    return indicesfromDetails;
}

function getDistinctAcrossOfErrors(ofError: OfErrorObjectWithPath) {
    const ret: AnyError[][] = [];
    for (let i = 0; i < ofError.ofPaths.length - 1; i++) {
        const path = ofError.ofPaths[i];
        const pathErrors = path.filter(error => {
            const hasMatch = ofError.ofPaths.slice(i + 1).some(errors => {
                return errors.some(otherError => areErrorsEqual(error, otherError));
            });
            return !hasMatch;
        });
        if (pathErrors.length > 0) {
            ret.push(pathErrors);
        }
    }
    ret.push(ofError.ofPaths[ofError.ofPaths.length - 1]);

    if (ret.length < 2) {
        return ret.flat();
    }

    return [{
        ...ofError,
        ofPaths: ret,
    }];
}

function getMessageForError(error: VerboseErrorObject, omitBe = false) {
    switch (error.keyword) {
        case 'anyOf':
        case 'oneOf':
            return getMessageForOf(error as OfErrorObjectWithPath);
        case 'maxItems':
        case 'additionalItems':
        case 'unevaluatedItems':
            return `not have more than ${error.params.limit} ${pluralize('item', error.params.limit)}`;
        case 'minItems':
            return `have at least ${error.params.limit} ${pluralize('item', error.params.limit)}`;
        case 'maxProperties':
            return `not have more than ${error.params.limit} ${pluralize('property', error.params.limit)}`;
        case 'minProperties':
            return `have at least ${error.params.limit} ${pluralize('property', error.params.limit)}`;
        case 'additionalProperties':
            return `not include property '${error.params.additionalProperty}'`;
        case 'unevaluatedProperties':
            return 'not have unevaluated properties';
        case 'required':
            return `include property '${error.params.missingProperty}'`;
        case 'pattern':
            return `match pattern '${error.params.pattern}'`;
        case 'format':
            return `match format ${error.params.format}`;
        case 'maximum':
        case 'minimum':
        case 'exclusiveMaximum':
        case 'exclusiveMinimum':
            return `${omitBe ? '' : 'be '}${error.params.comparison} ${error.params.limit}`;
        case 'multipleOf':
            return `${omitBe ? '' : 'be '}a multiple of ${error.params.multipleOf}`;
        case 'type': {
            const type = error.params.type;
            let typesString = Array.isArray(type) ? type.join(' or ') : type;
            if (typesString === 'array') {
                const arrayOfType = error.parentSchema?.items?.type;
                if (arrayOfType) {
                    typesString = `${arrayOfType}[]`;
                }
            }
            return `${omitBe ? '' : 'be '}${typesString}${error.params.nullable ? ' or null' : ''}`;
        }
        case 'enum': {
            const allowedList = error.params.allowedValues
                .map((value: any) => (typeof value === 'string' || value instanceof String) ? `'${value}'` : value)
                .join(', ');
            const beWhat = error.params.allowedValues.length === 1 ? allowedList : `one of the following: ${allowedList}`;
            return `${omitBe ? '' : 'be '}${beWhat}`;
        }
        case 'const':
            return `${omitBe ? '' : 'be '} '${error.params.allowedValue}'`;
        case 'minLength': {
            if (error.params.limit === 1) {
                return `not be empty`;
            }
            return `${omitBe ? '' : 'be '}at least ${error.params.limit} characters`;
        }
        case 'maxLength':
            return `${omitBe ? '' : 'be '}no more than ${error.params.limit} ${pluralize('character', error.params.limit)}`;
        case 'uniqueItems': {
            const { i, j } = error.params;
            return `have all unique items (items ${Math.min(i, j)} and ${Math.max(i, j)} are identical)`;
        }
        case 'propertyNames':
            return `${omitBe ? '' : 'be '}a valid property name`;
        case 'contains': {
            return error.params.maxContains === undefined
                ? `contain at least ${error.params.minContains} valid ${pluralize('item', error.params.minContains)}`
                : `contain between ${error.params.minContains} and ${error.params.maxContains} valid ${pluralize('item', error.params.minContains)}`;
        }
        case 'dependencies':
            return `have ${error.params.deps} when ${error.params.property} is included`;
        default:
            return 'match schema';
    }
}

function getMessageForOf(ofError: OfErrorObjectWithPath) {
    try {
        const messageParts: string[] = [];

        // TODO: handle differing instancePath's

        let seenBe = false;
        // TODO: why am I checking ofPaths is undefined?
        ofError.ofPaths?.forEach(path => {
            const pathMessageParts: string[] = [];
            path.forEach(error => {
                const subMessage = getMessageForError(error, seenBe);
                if (subMessage.startsWith('be')) {
                    seenBe = true;
                }
                pathMessageParts.push(subMessage);
            });
            messageParts.push(pathMessageParts.join(' and '));
        });

        return messageParts.join(' or ');
    } catch(err) {
        return 'match one of the schema options';
    }
}

function isOfError(error: AnyError): error is OfErrorObject {
    return ofErrorKeywords.includes(error.keyword);
}
