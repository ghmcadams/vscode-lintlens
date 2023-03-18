// some code copied from eslint codebase
// https://github.com/eslint/eslint/blob/dd58cd4afa6ced9016c091fc99a702c97a3e44f0/lib/shared/ajv.js#L12

import Ajv from 'ajv';
import metaSchema from 'ajv/lib/refs/json-schema-draft-06.json';
import { getErrorMessages } from 'simple-ajv-errors';


const ajv = new Ajv({
    meta: false,
    useDefaults: true,
    validateSchema: false,
    missingRefs: "ignore",
    schemaId: "auto",
    strict: false,
    allErrors: true
});

ajv.addMetaSchema(metaSchema);
ajv.opts.defaultMeta = metaSchema.id;


export function validate(schema, data) {
    if (ajv.validate(schema, data)) {
        return { valid: true };
    }

    const errors = getErrorMessages(ajv.errors, {
        dataVar: 'options',
        data
    });

    return {
        valid: false,
        errors
    };
}
