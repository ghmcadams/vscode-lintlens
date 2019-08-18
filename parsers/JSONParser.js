const AcornParser = require('./AcornParser');

module.exports = class JSONParser extends AcornParser {
    constructor(document) {
        super(document);
    }
};
