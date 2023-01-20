import {
    createContext,
    Script,
} from 'vm';


export function match(config) {
    const {
        text = '',
        regexp = /.*/,
        timeout = 10000,
    } = config;

    const sandbox = {
        regexp,
        text,
        result: null
    };

    const context = createContext(sandbox);
    const script = new Script('result = text.match(regexp);');

    try {
        script.runInContext(context, { timeout });
    } catch(err) {
        return null;
    }

    return sandbox.result;
}
