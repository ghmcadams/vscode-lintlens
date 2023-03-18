declare module 'simple-ajv-errors' {
    import { ErrorObject } from 'ajv';

    interface Options {
        dataVar: string = 'data';
        data: unknown = {};
    }

    export function getErrorMessages(
        errors: ErrorObject[] | null,
        options: Options = {},
    ): string[];
}
