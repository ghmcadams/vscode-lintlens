declare module 'simple-ajv-errors' {
    import { ErrorObject } from 'ajv';

    interface Options {
        rootVar?: string;
    }

    interface SimpleError {
        message: string;
        instancePath: string;
        schemaPath: string;
        schema?: any;
        parentSchema?: object;
        data?: any;
    }

    /**
     * Get usable, human readable, simple error messages from ajv errors.
     * @param {ErrorObject[]} errors - The errors created as a result of calling ajv.validate().
     * @param {object=} options - Configuration options to help give the best result.
     * @param {string} [options.rootVar='data'] - The text to use for the root of the data variable.
     * @return {SimpleError[]} An array of simple errors.
     */
    export function getSimpleErrors(
        errors: ErrorObject[] | null,
        options?: Options,
    ): SimpleError[];
}
