declare module 'json-schema-docs' {
    interface FormatProvider {
        // TODO: fill in all required functions
    }

    // TODO: fill in jsdocs flowerbox
    /**
     * Get usable, human readable, simple error messages from ajv errors.
     * @param {ErrorObject[]} errors - The errors created as a result of calling ajv.validate().
     * @param {object=} options - Configuration options to help give the best result.
     * @param {string} [options.rootVar='data'] - The text to use for the root of the data variable.
     * @return {SimpleError[]} An array of simple errors.
     */
    export function getSchemaDocumentation(
        schema: object,
        formatter?: FormatProvider,
    ): string;
}


/*
types:

Requirements {
    [string]: {
        [string]: Scalar;
        message: string;
    };
}

Annotations: Record<string, unknown>;

Schema: union of all of the below (named XSchema - EX: ObjectSchema)

Property: Record<string, Schema>

Scalar: string | number | boolean;

usage
-------------------

any
    annotations: Annotations

not
    schema: Schema
    annotations: Annotations

nullvalue
    annotations: Annotations

object
    properties: Property[]
    requirements?: Requirements
    annotations: Annotations

array
    schema: Schema
    requirements?: Requirements
    annotations: Annotations

tuple
    items: Schema[]
    additionalItems?: Schema
    requirements?: Requirements
    annotations: Annotations

enumeration
    items: Scalar[]
    annotations: Annotations

constant
    value: Scalar
    annotations: Annotations

string
    requirements?: Requirements
    annotations: Annotations

numeric
    numericType: string
    requirements?: Requirements
    annotations: Annotations

boolean
    annotations: Annotations

anyOf
    items: Schema[]
    annotations: Annotations

oneOf
    items: Schema[]
    annotations: Annotations

allOf
    items: Schema[]
    annotations: Annotations

ifThenElse
    if: Schema
    then: Schema
    else?: Schema
    annotations: Annotations

multiType
    types: string[]
    annotations: Annotations

*/
