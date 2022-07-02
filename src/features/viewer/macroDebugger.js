const vscode = require("vscode");
const createKeccakHash = require('keccak');
const fs = require("fs");
const {execSync} = require("child_process");
const { hevmConfig } = require("../../options");
const { deployContract, writeMacro, runInUserTerminal, writeHevmCommand, compileMacro, registerError, compileFromFile, checkInstallations} = require("./utils");

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
      withState: options.stateChecked,
      hevmContractAddress: createKeccakHash("keccak256")
                            .update(Buffer.from(macro.toString()))
                            .digest("hex")
                            .toString("hex")
                            .slice(0,42),
    }
  
    // Compilable macro is the huff source code for our new macro object
    const compilableMacro = createCompiledMacro(sourceDirectory, macro, argsObject, currentFile, imports);
    
    const bytecode = compileFromFile(compilableMacro, "cache/macro.huff", sourceDirectory);
    const runtimeBytecode = deployContract(bytecode, config, sourceDirectory);

    // const {bytecode, runtimeBytecode} = compileMacro(compilableMacro)

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
    //TODO: strip out other main macros with regex - clean up all regex
    const paths = imports.map(importPath => `${cwd}/${dirPath}${importPath.replace(/#include\s?"./, "").replace('"', "")}`);
    paths.push(cwd+ "/" + currentFile);
    console.log(paths)
    const files = paths.map(path => fs.readFileSync(path)
      .toString()
      .replace(/#define\s?macro\s?MAIN[\s\S]*?{[\s\S]*?}/gsm, "") // remove main
      .replace(/#include\s".*"/gsm, "") // remove include
  );

  console.log("files")
  console.log(files)
  console.log("each")
  console.log(files.forEach(console.log))

  // //#include "../${currentFile}" - was the top line - do i need it if not compiling from files?
    const compilableMacro = `
${files.join("\n")}
#define macro MAIN() = takes(0) returns (0) {
  ${argsObject.join(" ")}
  ${macro.body}
}`;


    return compilableMacro
}


function runMacroDebugger(bytecode, runtimeBytecode, config, cwd) {
  // extract state
  const { withState, hevmContractAddress, hevmCaller, statePath } = config;  
  
  // If state is provided, we need to deploy the contract and persist constructor storage
  if (withState) {
    deployContract(bytecode, config, cwd);
  }

  const command = `hevm exec \
    --code ${runtimeBytecode.toString()} \
    --address ${config.hevmContractAddress} \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    ${withState ? "--state " + cwd + "/" + config.statePath : ""} \
    --debug`

    // command is cached into a file as execSync has a limit on the command size that it can execute
    writeHevmCommand(command, "cache/hevmtemp", cwd)

    // TODO: run the debugger - attach this to a running terminal
    runInUserTerminal("`cat " + cwd + "/cache/hevmtemp`")
}


module.exports = {
    startMacroDebugger
}