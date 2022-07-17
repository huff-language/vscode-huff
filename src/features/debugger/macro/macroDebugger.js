const createKeccakHash = require('keccak');
const fs = require("fs");
const { hevmConfig } = require("../../../options");
const { 
  deployContract, 
  runInUserTerminal, 
  writeHevmCommand, 
  registerError, 
  compileFromFile, 
  checkInstallations, 
  formatEvenBytes, 
} = require("../debuggerUtils");

/**Start Macro Debugger
 * 
 * Steps:
 *  - Given a macro
 *  - Create a new temporary huff file that contains the macro and all of it's imports
 *  - Compile the newly created file 
 *  - Deploy the file using --create to get the runtime bytecode
 *  - Run the runtime bytecode in hevm with the --debug flag in a new terminal
 * 
 * @param {String} sourceDirectory Working directory of the root of the workspace
 * @param {String} currentFile     The currently selected huff file
 * @param {Array<String>} imports  Imports found at the top of the selected file - to allow the compiler to inline macros from another file
 * @param {Object} macro           Macro object - contains takes, returns and the macro body text
 * @param {*} argsObject           The stack args provided by the user
 */
async function startMacroDebugger(sourceDirectory, currentFile, imports, macro, argsObject, options){
    if (!(await checkInstallations())) return;

    try {
       // Create deterministic deployment address for each contract
      const config = {
        ...hevmConfig,
        ...options,
        hevmContractAddress: createKeccakHash("keccak256")
                              .update(Buffer.from(macro.toString()))
                              .digest("hex")
                              .toString("hex")
                              .slice(0,42),
    }

    // Compilable macro is the huff source code for our new macro object
    let compilableMacro = createCompiledMacro(sourceDirectory, macro, argsObject, currentFile, imports);

    // Create a constructor that will set storage slots -> TODO: run this manually against hevm git repository
    if (config.storageChecked) compilableMacro = overrideStorage(compilableMacro, config);

    const bytecode = compileFromFile(compilableMacro, config.tempMacroFilename, sourceDirectory);
    const runtimeBytecode = deployContract(bytecode, config, sourceDirectory);

    // deploy the contract to get the runtime code
    runMacroDebugger(bytecode, runtimeBytecode, config, sourceDirectory);
    } catch (e) {
      registerError(e, "Macro Compilation Error, this is pre-release software, please report this issue to the huff team in the discord");
      return null;
    }
   
  }

/**Create compiled macro
 * 
 * Creates a huff file that imports all required macros and builds ONLY
 * the macro we want to test inside its runtime bytecode
 * 
 * @param {String} cwd The directory of the user's workspace
 * @param {String} macro The macro being tested
 * @param {Array<String>} argsObject The args to push onto the stack
 * @param {String} currentFile The current file being debugged
 * @param {Array<String>} imports The imports at the top of the file being debugged
 * @returns 
 */
function createCompiledMacro(cwd, macro, argsObject, currentFile, imports) {
    // get relative path
    const dirPath = currentFile.split("/").slice(0,-1).join("/")

    // flatten imports 
    const paths = imports.map(importPath => `${cwd}/${dirPath}${importPath.replace(/#include\s?"./, "").replace('"', "")}`);
    paths.push(cwd+ "/" + currentFile);
    const files = paths.map(path => fs.readFileSync(path)
      .toString()
      .replace(/#define\s?macro\s?MAIN[\s\S]*?{[\s\S]*?}/gsm, "") // remove main
      .replace(/#include\s".*"/gsm, "") // remove include
    );

    // replace jump labels
    let macroBody = macro.body;
    const jumpLabelRegex = /<.*>/gm; 
    if (jumpLabelRegex.test(macroBody)) {
      console.log("jump label found in macro")
      macroBody = macroBody.replace(jumpLabelRegex, "error");
      macroBody += "error:\n\t0x0 dup1 stop";
    }

  // //#include "../${currentFile}" - was the top line - do i need it if not compiling from files?
    const compilableMacro = `
${files.join("\n")}
#define macro MAIN() = takes(0) returns (0) {
  ${argsObject.reverse().join(" ")}
  ${macroBody}
}`;


    return compilableMacro
}


function runMacroDebugger(bytecode, runtimeBytecode, config, cwd) {
  // extract state
  const { 
    stateChecked, 
    hevmContractAddress, 
    hevmCaller, 
    statePath, 
    calldataChecked,
    calldataValue,
    storageChecked
  } = config;  
  
  
  const hevmCommand = `hevm exec \
    --code ${runtimeBytecode.toString()} \
    --address ${hevmContractAddress} \
    --caller ${hevmCaller} \
    --gas 0xffffffff \
    ${stateChecked || storageChecked  ? "--state " + cwd + "/" + statePath : ""} \
    ${calldataChecked ? "--calldata " + formatEvenBytes(calldataValue) : ""} \
    --debug`

    // command is cached into a file as execSync has a limit on the command size that it can execute
    writeHevmCommand(hevmCommand, config.tempHevmCommandFilename, cwd)

    // TODO: run the debugger - attach this to a running terminal
    const terminalCommand = "`cat " + cwd + "/" + config.tempHevmCommandFilename + "`"; 
    runInUserTerminal(terminalCommand);
}

/**Override storage
 * 
 * As temp method this will override the storage using the contracts constructor
 * The long term goal is to convert this method to alter hevms store directly
 * 
 * @param {String} macro 
 * @param {Object} config 
 * @returns 
 */
function overrideStorage(macro, config) {
  // write a temp file that will set storage slots
  const {stateValues} = config;

  const constructorRegex = /#define\s+macro\s+CONSTRUCTOR\s?\((?<args>[^\)]*)\)\s?=\s?takes\s?\((?<takes>[\d])\)\s?returns\s?\((?<returns>[\d])\)\s?{(?<body>[\s\S]*?(?=}))/gsm
  const constructorMatch = constructorRegex.exec(macro);

  // get string of sstore overrides
  let overrides = "";
  for (const state of stateValues){
    overrides += `${state.value} ${state.key} sstore\n`
  }
  
  // if there is a constructor
  if (constructorMatch) {
    // append overrides to the end of the constructor macro
    return macro.replace(constructorRegex, constructorMatch[0] + "\n\t" + overrides);    
  }
  
  // otherwise create a constructor at the end
  let content = "";
  content = "\n#define macro CONSTRUCTOR() = takes(0) returns(0) {\n\t";
  content += overrides;
  content += "}";

  return macro + content;
}


module.exports = {
    startMacroDebugger
}