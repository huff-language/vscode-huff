// Dependencies
const createKeccakHash = require('keccak');

/**Camel to Snake Case
 * 
 * Convert a camel-case function definition to snake case
 * 
 * @param {*} str 
 * @returns 
 */
const camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

////////////////////////////////////////////////
//              REGEX DEFINITIONS             //
////////////////////////////////////////////////
const commentRegex = () => new RegExp(`(?:${commentRegex.line().source})|(?:${commentRegex.block().source})`, 'gm');
commentRegex.line = () => /(?:^|\s)\/\/(.+?)$/gm;
commentRegex.block = () => /\/\*([\S\s]*?)\*\//gm;

const TYPE_ALIASES = {
    'int': 'int256',
    'uint': 'uint256',
    'fixed': 'fixed128x18',
    'ufixed': 'ufixed128x18',
    'function': 'bytes24',
};
const evmTypeRegex = new RegExp(`(?<type>(${Object.keys(TYPE_ALIASES).join('|')}))(?<tail>(\\[[^\\]]*\\])?)$`, 'g');


/**Cannoicalize Evm Types
 * 
 * Convert abitypes and aliases
 * 
 * @param {*} evmArg 
 * @returns 
 */
function canonicalizeEvmType(evmArg) {
    function replacer(...groups) {
        const foundings = groups.pop();
        return `${TYPE_ALIASES[foundings.type]}${foundings.tail}`;
    }
    return evmArg.replace(evmTypeRegex, replacer);
}

/**Function Signature Extractor
 * 
 * Extract all interface matching abi definitions from the current file
 * 
 * @param {*} content 
 * @returns 
 */
function functionSignatureExtractor(content){
    const publicFuncSigRegex = /function\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/g;
    // const publicFuncSigRegex = /function\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\).*(public|external)?/g;
    let match;
    let sighashes = {};
    let collisions = [];

    while (match = publicFuncSigRegex.exec(content)){
        let args = match.groups.args.replace(commentRegex(), "").split(",").map(item => canonicalizeEvmType(item.trim().split(" ")[0]));
        let fnSig = `${match.groups.name.trim()}(${args.join(",")})`;
        let sigHash = createKeccakHash('keccak256').update(fnSig).digest("hex").toString("hex").slice(0,8);

        if (sigHash in sighashes && sighashes[sigHash] !== fnSig){
            collisions.push(sigHash);
        }
        sighashes[sigHash] = fnSig;
    }
    return {sighashes, collisions}
}

module.exports = {
    functionSignatureExtractor,
    camelToSnakeCase
}