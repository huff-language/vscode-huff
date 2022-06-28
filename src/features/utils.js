// Dependencies
const createKeccakHash = require('keccak');

/**Function Signature Extractor
 * 
 * Extract all interface matching abi definitions from the current file
 * 
 * @param {*} content 
 * @returns 
 */
 function functionSignatureExtractor(content){
    const publicFuncSigRegex = /function\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/g;
    
    return signatureExtractor(content, publicFuncSigRegex, 8)
}

// create a function that can perform both of these as one
function eventSignatureExtractor(content){
    const interfaceFuncSigRegex = /event\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/g;

    return signatureExtractor(content, interfaceFuncSigRegex)
}

/**Signature Extractor
 * 
 * Given the current workpage and a regex pattern (assumed to be looking for evm types)
 * return keccak of those sigs. Specify return length if getting func sigs.  
 * 
 * @param {*} content 
 * @param {*} matchPattern 
 * @param {*} returnLength 
 * @returns 
 */
function signatureExtractor(content, matchPattern, returnLength=64){

    let match;
    let sigHashes = {};
    let collisions = {};

    while (match = matchPattern.exec(content)){
        let args = match.groups.args.replace(commentRegex(), "").split(",").map(item => canonicalizeEvmType(item.trim().split(" ")[0]));
        let fnSig = `${match.groups.name.trim()}(${args.join(",")})`;
        let sigHash = createKeccakHash('keccak256').update(fnSig).digest("hex").toString("hex").slice(0,returnLength);
        
        if (sigHash in sigHashes && sigHashes[sigHash] !== fnSig){
            collisions.push(sigHash);
        }
        sigHashes[sigHash] = fnSig;
    }

    return {sigHashes, collisions}
}

function getFunctionSignaturesAndArgs(content){
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
        sighashes[sigHash] = {fnSig, args};
    }
    return {sighashes, collisions}
}

function getMacros(content){
    //takes(?<takes>[^\)]*)\)
    const macroRegex = /#define\s+macro\s+(?<name>[^\(\s]+)\s?\(\)\s?=\s?takes\s?\((?<takes>[\d])\)\s?returns\s?\((?<returns>[\d])\)\s?{(?<body>[\s\S]*?(?=}))/gsm;
    let match;
    let macros = {};
    
    // find all of the macros and add them to the return object
    while (match = macroRegex.exec(content)){
        console.log(match)
        const {name, takes, returns, body} = match.groups;
        macros[name] = { takes, returns, body }
    }
    return macros;
}

function getImports(content){
    const importRegex = /#include\s+(?<file>[^\(\s]+)/gm;

    let match;
    let imports = [];
    
    while (match = importRegex.exec(content)){
        // get the match pattern
        imports.push(match[0]);
    }
    return imports;
}


/**Camel to Snake Case
 * 
 * Convert a camel-case function definition to snake case
 * 
 * @param {*} str 
 * @returns 
 */
 const camelToSnakeCase = str => str.replace(/\B(?=[A-Z])/g, letter => `_${letter.toLowerCase()}`);

 const splitCaps = str => str
    .replace(/([a-z])([A-Z]+)/g, (m, s1, s2) => s1 + ' ' + s2)
    .replace(/([A-Z])([A-Z]+)([^a-zA-Z0-9]*)$/, (m, s1, s2, s3) => s1 + s2.toLowerCase() + s3)
    .replace(/([A-Z]+)([A-Z][a-z])/g, 
        (m, s1, s2) => s1.toLowerCase() + ' ' + s2);

/**To Upper Snake Case
 *
 * Convert a normal camel-case string to upper snake case
 * Uses [splitCaps] and [camelToSnakeCase].
 *  
 * @param {*} str 
 * @returns An uppercase snake case representation of camel case input
 */
const toUpperSnakeCase = str => camelToSnakeCase(splitCaps(str)).toUpperCase();

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

module.exports = {
    functionSignatureExtractor,
    eventSignatureExtractor,
    toUpperSnakeCase,
    camelToSnakeCase,
    getFunctionSignaturesAndArgs,
    getMacros,
    getImports
}