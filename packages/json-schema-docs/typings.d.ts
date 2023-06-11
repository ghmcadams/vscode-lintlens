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
data included:

any
    annotations: Annotation[]

not
    schema: Schema
    annotations: Annotation[]

nullvalue
    annotations: Annotation[]

object
    properties: Property[]
    requirements?: Requirement[]
    annotations: Annotation[]

array
    schema: Schema
    requirements?: Requirement[]
    annotations: Annotation[]

tuple
    items: Schema[]
    additionalItems?: Schema
    requirements?: Requirement[]
    annotations: Annotation[]

enumeration
    items: scalar[]
    annotations: Annotation[]

constant
    value: scalar
    annotations: Annotation[]

string
    requirements?: Requirement[]
    annotations: Annotation[]

numeric
    numericType: string
    requirements?: Requirement[]
    annotations: Annotation[]

boolean
    annotations: Annotation[]

anyOf
    items: Schema[]
    annotations: Annotation[]

oneOf
    items: Schema[]
    annotations: Annotation[]

allOf
    items: Schema[]
    annotations: Annotation[]

ifThenElse
    if: Schema
    then: Schema
    else?: Schema
    annotations: Annotation[]

multiType
    types: string[]
    annotations: Annotation[]

*/
