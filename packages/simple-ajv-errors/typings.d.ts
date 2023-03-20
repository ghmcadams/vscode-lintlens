declare module 'simple-ajv-errors' {
    import { ErrorObject } from 'ajv';

    interface Options {
        dataVar: string = 'data';
    }

    /**
     * Get usable, human readable, simple error messages from ajv errors.
     * @param {ErrorObject[]} errors - The errors created as a result of calling ajv.validate().
     * @param {object=} options - Configuration options to help give the best result.
     * @param {string} [options.dataVar='data'] - The text to use for the root of the data variable.
     * @param {*} options.data - The data that was passed to ajv.validate().
     * @return {string[]} An array of error messages.
     */
    export function getErrorMessages(
        errors: ErrorObject[] | null,
        options: Options = {},
    ): string[];
}
