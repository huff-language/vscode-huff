// Dependencies
const createKeccakHash = require("keccak");

// Define regex components
const macroOrFunctionRegex =
  /#define\s+(macro|fn)\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\).*?{(?<body>[\s\S]*?(?=}))/gm;
const macroOrFunctionGroupsRegex =
  /#define\s+(macro|fn)\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)\s?=\s?takes\s?\((?<takes>[\d])\)\s?returns\s?\((?<returns>[\d])\)\s?{(?<body>[\s\S]*?(?=}))/gms;
const macroOrFunctionGroupsRegexTrailing =
  /#define\s+(macro|fn)\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)\s?=\s?takes\s?\((?<takes>[\d])\)\s?returns\s?\((?<returns>[\d])\)\s?{(?<body>[\s\S]*?(?=}))}/gms;
const publicFuncSigRegex =
  /function\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/g;
const interfaceFuncSigRegex =
  /event\s+(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/g;
const macroCallRegex = /(?<name>[^\(\s]+)\s?\((?<args>[^\)]*)\)/gm;

/**Function Signature Extractor
 *
 * Extract all interface matching abi definitions from the current file
 *
 * @param {*} content
 * @returns
 */
function functionSignatureExtractor(content) {
  let regex = new RegExp(publicFuncSigRegex);
  return signatureExtractor(content, regex, 8);
}

/**Event Signature Extractor
 *
 * Get all of the events defined within the current file
 * @param {String} content
 * @returns
 */
function eventSignatureExtractor(content) {
  let regex = new RegExp(interfaceFuncSigRegex);
  return signatureExtractor(content, regex);
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
function signatureExtractor(content, matchPattern, returnLength = 64) {
  let match;
  let sigHashes = {};
  let collisions = {};

  while ((match = matchPattern.exec(content))) {
    let args = match.groups.args
      .replace(commentRegex(), "")
      .split(",")
      .map((item) => canonicalizeEvmType(item.trim().split(" ")[0]));
    let fnSig = `${match.groups.name.trim()}(${args.join(",")})`;
    let sigHash = createKeccakHash("keccak256")
      .update(fnSig)
      .digest("hex")
      .toString("hex")
      .slice(0, returnLength);

    if (sigHash in sigHashes && sigHashes[sigHash] !== fnSig) {
      collisions.push(sigHash);
    }
    sigHashes[sigHash] = fnSig;
  }

  return { sigHashes, collisions };
}

/**Get Function Signature and args
 *
 * Parse all of the function definitions for the current file
 * @param {String} content
 * @returns
 */
function getFunctionSignaturesAndArgs(content) {
  let match;
  let sighashes = {};
  let collisions = [];

  let regex = new RegExp(publicFuncSigRegex);
  while ((match = regex.exec(content))) {
    let args = match.groups.args.length
      ? match.groups.args
          .replace(commentRegex(), "")
          .split(",")
          .map((item) => canonicalizeEvmType(item.trim().split(" ")[0]))
      : [];
    let fnSig = `${match.groups.name.trim()}(${args.join(",")})`;
    let sigHash = createKeccakHash("keccak256")
      .update(fnSig)
      .digest("hex")
      .toString("hex")
      .slice(0, 8);
    if (sigHash in sighashes && sighashes[sigHash] !== fnSig) {
      collisions.push(sigHash);
    }
    sighashes[sigHash] = { fnSig, args };
  }
  return { sighashes, collisions };
}

/**Get Macros
 *
 * Get all of the macro definitions in the current file
 * @param {String} content
 * @returns {Object}
 */
function getMacros(content) {
  let regex = new RegExp(macroOrFunctionGroupsRegex);

  // find all of the macros and add them to the return object
  while ((match = regex.exec(content))) {
    const { name, takes, returns, body } = match.groups;
    macros[name] = { takes, returns, body };
  }
  return macros;
}

/** Get Macros as Array
 *
 * @param {String} content
 * @returns
 */
function getMacroAsArray(content) {
  let macros = [];
  let regex = new RegExp(macroOrFunctionGroupsRegexTrailing);

  // find all of the macros and add them to the return object
  while ((match = regex.exec(content))) {
    const { name, takes, returns, body } = match.groups;
    const { index } = match;
    const indexEnd = index + match[0].length;
    macros.push({ takes, returns, body, index, indexEnd });
  }
  return macros;
}

function getMacroByName(content, name) {
  const macroRegex = `#define\\s+(macro|fn)?\\s+${name}\\s?\\((?<args>[^\\)]*)\\)\\s?=\\s?takes\\s?\\((?<takes>[\\d])\\)\\s?returns\\s?\\((?<returns>[\\d])\\)\\s?{(?<body>[\\s\\S]*?(?=}))}`;
  const regex = new RegExp(macroRegex, "gms");

  let match = regex.exec(content);
  if (match) {
    return [match.groups.takes, match.groups.returns];
  }
  return [null, null];
}

function getMacroGroups(macroString) {
  let regex = new RegExp(macroOrFunctionGroupsRegexTrailing);
  let match = regex.exec(macroString);

  if (match) {
    return match.groups;
  }
  return null;
}

/**Get Imports
 *
 * Get all of the include statements in the current file
 * @param {String} content
 * @returns
 */
function getImports(content) {
  const importRegex = /#include\s+(?<file>[^\(\s]+)/gm;

  let match;
  let imports = [];

  while ((match = importRegex.exec(content))) {
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
const camelToSnakeCase = (str) =>
  str.replace(/\B(?=[A-Z])/g, (letter) => `_${letter.toLowerCase()}`);

const splitCaps = (str) =>
  str
    .replace(/([a-z])([A-Z]+)/g, (m, s1, s2) => s1 + " " + s2)
    .replace(
      /([A-Z])([A-Z]+)([^a-zA-Z0-9]*)$/,
      (m, s1, s2, s3) => s1 + s2.toLowerCase() + s3
    )
    .replace(
      /([A-Z]+)([A-Z][a-z])/g,
      (m, s1, s2) => s1.toLowerCase() + " " + s2
    );

/**To Upper Snake Case
 *
 * Convert a normal camel-case string to upper snake case
 * Uses [splitCaps] and [camelToSnakeCase].
 *
 * @param {*} str
 * @returns An uppercase snake case representation of camel case input
 */
const toUpperSnakeCase = (str) =>
  camelToSnakeCase(splitCaps(str)).toUpperCase();

////////////////////////////////////////////////
//              REGEX DEFINITIONS             //
////////////////////////////////////////////////
const commentRegex = () =>
  new RegExp(
    `(?:${commentRegex.line().source})|(?:${commentRegex.block().source})`,
    "gm"
  );
commentRegex.line = () => /(?:^|\s)\/\/(.+?)$/gm;
commentRegex.block = () => /\/\*([\S\s]*?)\*\//gm;

const TYPE_ALIASES = {
  int: "int256",
  uint: "uint256",
  fixed: "fixed128x18",
  ufixed: "ufixed128x18",
  function: "bytes24",
};
const evmTypeRegex = new RegExp(
  `(?<type>(${Object.keys(TYPE_ALIASES).join("|")}))(?<tail>(\\[[^\\]]*\\])?)$`,
  "g"
);

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
  getImports,
  getMacroAsArray,
  getMacroByName,
  getMacroGroups,
  macroOrFunctionRegex,
  macroCallRegex,
};
