const vscode = require("vscode");
const ethers = require("ethers"); 
const fs = require("fs");
const {execSync} = require("child_process");
const { hevmConfig } = require("../../options");
const { deployContract, checkHevmInstallation, writeMacro, runInUserTerminal} = require("./utils");

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
async function startMacroDebugger(sourceDirectory, currentFile, imports, macro, argsObject){
    if (!checkHevmInstallation()) return;

    // Create deterministic deployment address for each contract
    const config = {
      ...hevmConfig,
      hevmContractAddress: ethers.utils.keccak256(Buffer.from(macro.toString())).toString().slice(0,42),
    }
  
    // Compilable macro is the huff source code for our new macro object
    const compilableMacro = createCompiledMacro(sourceDirectory, macro, argsObject, currentFile, imports);
    
    // Write this source code to a temp location
    writeMacro(sourceDirectory, config.tempMacroFilename, compilableMacro)
  
    // Compile the newly created macro
    const macroDeploymentBytecode = compileMacro(sourceDirectory, config.tempMacroFilename)
    
    // deploy the contract to get the runtime code
    const macroRuntimeBytecode = deployContract(macroDeploymentBytecode, config, sourceDirectory, true);
    runMacroDebugger(macroRuntimeBytecode, config, sourceDirectory);
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
    const compilableMacro = `
    #include "${cwd}/${currentFile}"
    ${imports.map(file => file.replace('".', `"${cwd}`)).join("\n")}
    #define macro MAIN() = takes(0) returns (0) {
      ${argsObject.join(" ")}
      ${macro.body}
    }`;
    return compilableMacro
}


/**Compile Macro
 * 
 * TODO: don't assume that the current macro is located at cache/tempMacro.huff
 * 
 * Returns the compiled macro's bytecode
 * 
 * @param {String} sourceDirectory Root workspace directory
 * @param {String} tempFileLocation Location of the temp compiled macro 
 * @returns {String} bytecode - Bytecode string returned by the huff compiler
 */
const compileMacro = (sourceDirectory, tempFileLocation) => {
    //TODO: check for the existence of the huff compiler - if it does not exist then prompt for it's installation
  
    const command = `npx huffc ${sourceDirectory}/${tempFileLocation}.huff --bytecode`;
    const bytecode = execSync(command, {cwd: sourceDirectory});
    return `0x${bytecode.toString()}`;
}
  
function runMacroDebugger(bytecode, config, cwd) {
    const command = `hevm exec \
    --code ${bytecode.toString()} \
    --address ${config.hevmContractAddress} \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    --debug`

    // command is cached into a file as execSync has a limit on the command size that it can execute
    fs.writeFileSync(cwd + "/cache/hevmtemp", command, {cwd});

    // TODO: run the debugger - attach this to a running terminal
    runInUserTerminal("`cat " + cwd + "/cache/hevmtemp`")
}


module.exports = {
    startMacroDebugger
}