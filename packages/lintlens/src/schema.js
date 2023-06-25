import { validate } from './ajv';


const severityMap = {
    off: 0,
    warn: 1,
    error: 2
};

export function validateConfigFromSchema(schema, config) {
    const severityConfig = Array.isArray(config) ? config[0] : config;
    const severityValidation = validateRuleSeverity(severityConfig);

    const nonSeverityConfig = Array.isArray(config) ? config.slice(1) : []
    const nonSeverityValidation = validateRuleOptions(schema, nonSeverityConfig);

    return {
        severity: severityValidation,
        options: nonSeverityValidation
    };
}


function cleanUpSchema(schema) {
    if (Array.isArray(schema)) {
        if (schema.length) {
            return {
                type: "array",
                items: schema,
                minItems: 0,
                maxItems: schema.length
            };
        }
        return {
            type: "array",
            minItems: 0,
            maxItems: 0
        };
    }

    // Given a full schema, leave it alone
    return schema ?? null;
}

function validateRuleSeverity(config) {
    const ret = {
        valid: true,
        errors: []
    };

    const normSeverity = typeof config === "string" ? severityMap[config.toLowerCase()] : config;

    ret.valid = [0, 1, 2].includes(normSeverity);
    if (!ret.valid) {
        ret.errors = ['Severity must be one of the following: "error" (or 2), "warn" (or 1), "off" (or 0).'];
    }

    return ret;
}

function validateRuleOptions(schema, config) {
    const ret = {
        valid: true,
        errors: []
    };

    try {
        if (schema && config) {
            const cleanedSchemaConfig = cleanUpSchema(schema);
            return validate(cleanedSchemaConfig, config);
        }
    } catch(err) {
        console.log(err);
    }

    return ret;
}
