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

Annotations {
    title: string;
    description: string;
    examples: unknown[]; // TODO: can I make this better with generics?
}

BaseSchema {
    default?: boolean;
    deprecated?: boolean;
    annotations?: Annotations;
}

Schema: union of all of the below (named XSchema - EX: ObjectSchema)

Property: Record<string, Schema>

Scalar: string | number | boolean;

schemas (all are based on BaseSchema)
-------------------

any

not
    schema: Schema

nullvalue

object
    properties: Property[]
    requirements?: Requirements

array
    schema: Schema
    requirements?: Requirements

tuple
    items: Schema[]
    additionalItems?: Schema
    requirements?: Requirements

enumeration
    items: Scalar[]

constant
    value: Scalar

string
    requirements?: Requirements

numeric
    numericType: string
    requirements?: Requirements

boolean

anyOf
    items: Schema[]

oneOf
    items: Schema[]

allOf
    items: Schema[]

ifThenElse
    if: Schema
    then: Schema
    else?: Schema

multiType
    types: string[]

*/
