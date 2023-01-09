// copied from eslint codebase
// https://github.com/eslint/eslint/blob/dd58cd4afa6ced9016c091fc99a702c97a3e44f0/lib/shared/ajv.js#L12

import Ajv from 'ajv';
import metaSchema from 'ajv/lib/refs/json-schema-draft-04.json';


const ajv = new Ajv({
    meta: false,
    useDefaults: true,
    validateSchema: false,
    missingRefs: "ignore",
    verbose: true,
    schemaId: "auto",
    allErrors: true
});

ajv.addMetaSchema(metaSchema);
ajv._opts.defaultMeta = metaSchema.id;


export default ajv;
