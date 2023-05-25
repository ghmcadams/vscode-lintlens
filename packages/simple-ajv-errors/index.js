import clone from 'clone';
import levenshtein from 'damerau-levenshtein';


const ofErrorKeywords = ['anyOf', 'oneOf'];

// Add parents if one of these keywords
const parentKeywordsOk = [
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


export function getSimpleErrors(errors, options = {}) {
    if (!errors || errors.length === 0) {
        return [];
    }

    const {
        dataVar = 'data',
    } = options;

    const processedErrors = processErrors(errors);

    const simpleErrors = processedErrors.map((error) => {
        const path = getPath(dataVar, error.instancePath);
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

function getPath(dataVar, instancePath) {
    if (instancePath === '') {
        return dataVar;
    }

    const pointer = `${dataVar}${instancePath}`;
    return pointer.replace(/\/(\d+)/g, '[$1]').replace(/\/(\w+)/g, '.$1');
}

function processErrors(errors) {
    const clonedErrors = clone(errors);

    const ofHierarchy = getOfHierarchy(clonedErrors);
    const processedErrors = filterByChosenPath(ofHierarchy);

    return processedErrors;
}

function getOfHierarchy(errors) {
    const ofs = errors.filter(({ keyword }) => ofErrorKeywords.includes(keyword));
    if (ofs.length === 0) {
        return errors;
    }

    replaceSchemaRefs(errors);

    const ret = [];
    // Loop through non OF errors
    const nonOfErrors = errors.filter(({ keyword }) => !ofErrorKeywords.includes(keyword));
    for (const error of nonOfErrors) {
        // store list of OF schema paths for this error
        const schemaOfs = [];
        const schemaParts = error.schemaPath.split('/');
        schemaParts.pop(); // Ignore the last element (current error)
        schemaParts.forEach((part, index) => {
            if (ofErrorKeywords.includes(part)) {
                schemaOfs.push(schemaParts.slice(0, index + 1).join('/'));
            }
        });

        let ref = ret;
        for (const schemaPath of schemaOfs) {
            // already stored
            const refError = ref.flat().find(item => item.schemaPath === schemaPath);
            if (refError) {
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
                    const choiceIndex = getParentChoiceIndex(ref, ofError.schemaPath);
                    ref[choiceIndex] = ref[choiceIndex] ?? [];
                    ref[choiceIndex].push(ofError);
                }

                ref = ofError.choices;
                continue;
            }

            // OF not found anywhere (not supposed to happen)
            break;
        }

        if (ofErrorKeywords.includes(error.keyword)) {
            error.choices = [];
        }

        if (ref === ret) {
            ref.push(error);
        } else {
            const choiceIndex = getParentChoiceIndex(ref, error.schemaPath);
            ref[choiceIndex] = ref[choiceIndex] ?? [];
            ref[choiceIndex].push(error);
        }
    }

    return ret;
}

function replaceSchemaRefs(errors) {
    errors.forEach(error => {
        if (!Array.isArray(error.schema)) {
            return;
        }
        error.schema.forEach((item, index) => {
            const schemaPathReplacement = `${error.schemaPath}/${index}`;

            if (getType(item) === 'object' && item.hasOwnProperty('$ref')) {
                errors.forEach(otherError => {
                    if (otherError.instancePath === error.instancePath) {
                        otherError.schemaPath = otherError.schemaPath.replace(item.$ref, schemaPathReplacement);

                        if (otherError.schemaPath.slice(schemaPathReplacement.length + 1).includes('/')) {
                            error.schema[index] = otherError.parentSchema;
                        }
                    }
                });
            }
        });
    });
}

function getParentChoiceIndex(parent, schemaPath) {
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

function filterByChosenPath(ofHierarchy) {
    const ret = [];

    for (const error of ofHierarchy) {
        if (ofErrorKeywords.includes(error.keyword)) {
            const chosenPaths = getChosenPaths(error);
            const {
                choices,
                ...ofError
            } = error;

            if (chosenPaths.length === 1) {
                ret.push(...filterByChosenPath(choices[chosenPaths[0]]));
                continue;
            }
            if (chosenPaths.length > 1) {
                const ofPaths = chosenPaths.map(pathIndex => filterByChosenPath(choices[pathIndex]));
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

function findLowestErrors(errors) {
    const tracker = new Map();

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

function getChosenPaths(error) {
    const {
        choices,
        data,
        schema
    } = error;

    const choiceIndices = choices.reduce((ret, item, index) => {
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

    const indicesTypeMatch = choiceIndices.reduce((ret, index) => {
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
        return getChosenPathsWhenObject(error, indicesTypeMatch);
    }
    if (typeofData === 'array') {
        return getChosenPathsWhenArray(error, indicesTypeMatch);
    }

    return indicesTypeMatch;
}

function getValueMatchScore(data, values) {
    const valuesToCheck = Array.isArray(values) ? values : [values];
    return Math.max(...valuesToCheck.map(value => {
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

function getChosenPathsWhenObject(error, indices) {
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

function getPropertyMatchScore(data, schema) {
    const schemaTypes = getSchemaType(schema);
    if (!schemaTypes.includes('object')) {
        return [index, 0];
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

function getChosenPathsWhenArray(error, indices) {
    if (!indices || indices.length === 0) {
        return indices;
    }

    const {
        data,
        schema
    } = error;

    // minItems and maxItems matches data item count
    const dataItemCount = data.length;
    const indicesfromArray = indices.reduce((ret, index) => {
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
    const indicesfromDetails = indicesfromArray.reduce((ret, index) => {
        const entry = schema[index];
        if (!entry.items) {
            return ret;
        }

        let items = entry.items;
        let isTuple = true;
        if (getType(items) === 'object') {
            isTuple = false;

            if (items.hasOwnProperty('anyOf')) {
                items = items.anyOf;
            } else if (items.hasOwnProperty('oneOf')) {
                items = items.oneOf;
            } else {
                items = [items];
            }
        }

        data.forEach((dataItem, dataIndex) => {
            // if it is a tuple, then the length must match
            // allowing less than for in progress scenarios
            if (isTuple && data.length > items.length) {
                return;
            }

            const dataItemType = getType(dataItem);

            const itemsForThisIndex = isTuple ? [items[dataIndex]] : items;
            const anyMatch = itemsForThisIndex.some(item => {
                const itemTypes = getSchemaType(item);

                if (!itemTypes.includes(dataItemType)) {
                    return false;
                }

                // if it matches any of the enum values, return true
                if (item.hasOwnProperty('enum')) {
                    if (item.enum.includes(dataItem)) {
                        return true;
                    }
                }

                if (dataItemType === 'object') {
                    // TODO: static score is less meaningful - need to compare with others
                    const matchScore = getPropertyMatchScore(dataItem, item);
                    if (matchScore > 0.5) {
                        return true;
                    }
                }
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

function getDistinctAcrossOfErrors(ofError) {
    const ret = [];
    for (let i = 0; i < ofError.ofPaths.length - 1; i++) {
        const path = ofError.ofPaths[i];
        const pathErrors = path.filter(error => {
            const hasMatch = ofError.ofPaths.slice(i + 1).some(errors => {
                return errors.some(otherError => doErrorsMatch(error, otherError));
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

function doErrorsMatch(a, b) {
    return (
        a.instancePath === b.instancePath &&
        a.keyword === b.keyword &&
        JSON.stringify(a.params) === JSON.stringify(b.params)
    );
}

function getMessageForError(error, omitBe = false) {
    switch (error.keyword) {
        case 'anyOf':
        case 'oneOf': 
            return getMessageForOf(error);
        case 'maxItems':
        case 'additionalItems':
        case 'unevaluatedItems':
            return `not have more than ${error.params.limit} ${getPlural('item', error.params.limit)}`;
        case 'minItems':
            return `have at least ${error.params.limit} ${getPlural('item', error.params.limit)}`;
        case 'maxProperties':
            return `not have more than ${error.params.limit} ${getPlural('property', error.params.limit)}`;
        case 'minProperties':
            return `have at least ${error.params.limit} ${getPlural('property', error.params.limit)}`;
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
                .map(value => (typeof value === 'string' || value instanceof String) ? `'${value}'` : value)
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
            return `${omitBe ? '' : 'be '}no more than ${error.params.limit} ${getPlural('character', error.params.limit)}`;
        case 'uniqueItems': {
            const { i, j } = error.params;
            return `have all unique items (items ${Math.min(i, j)} and ${Math.max(i, j)} are identical)`;
        }
        case 'propertyNames':
            return `${omitBe ? '' : 'be '}a valid property name`;
        case 'contains': {
            return error.params.maxContains === undefined
                ? `contain at least ${error.params.minContains} valid ${getPlural('item', error.params.minContains)}`
                : `contain between ${error.params.minContains} and ${error.params.maxContains} valid ${getPlural('item', error.params.minContains)}`;
        }
        case 'dependencies':
            return `have ${error.params.deps} when ${error.params.property} is included`;
        default:
            return 'match schema';
    }
}

function getPlural(text, limit) {
    const baseText = text.endsWith('y') ? text.slice(0, -1) : text;
    const plural = text.endsWith('y') ? 'ies' : 's';
    return `${baseText}${limit === 1 ? '' : plural}`;
}

function getMessageForOf(ofError) {
    try {
        const messageParts = [];

        // TODO: handle differing instancePath's

        let seenBe = false;
        ofError.ofPaths?.forEach(path => {
            const pathMessageParts = [];
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

function getType(variable) {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
}

function getSchemaType(entry) {
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

function getCommonPrefix(string1, string2) {
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
