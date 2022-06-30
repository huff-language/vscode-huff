const vscode = require("vscode");
const commandExists = require("command-exists");
const fs = require("fs");
const {execSync} = require("child_process");
const {default: compileHuff} = require("huffc");
const { getImports } = require("../utils");


/**Deploy Contract
 * 
 * Deploy the provided contract bytecode to hevm
 * 
 * @param {String} bytecode 
 * @param {Object} config 
 * @param {String} cwd 
 * @param {boolean} macro 
 * @returns 
 */
function deployContract(
    bytecode, 
    config, 
    cwd, 
    macro = false
  ) {
    if (config.withState){
        checkStateRepoExistence(config.statePath, cwd)
    }
  
      const command = `hevm exec
      --code ${bytecode} \
      --address ${config.hevmContractAddress} \
      --create \
      --caller ${config.hevmCaller} \
      --gas 0xffffffff \
      ${(config.state && !macro)  ? "--state " + cwd + "/" + config.statePath : ""}
      `
      // cache command
      writeHevmCommand(command, "cache/hevmtemp", cwd);
      
      // execute command
      return execSync("`cat " + cwd + "/cache/hevmtemp`")
}


/**Run in User Terminal
 * 
 * Execute a given command within a new terminal
 * 
 * @param {String} command 
 */
function runInUserTerminal(command){
    const terminal = vscode.window.createTerminal({name: "Huff debug"});
    terminal.sendText(command);
    terminal.show();
  }


function writeHevmCommand(command, file, cwd){
    
    try { !fs.accessSync(`${cwd}/cache`) }
    catch (e) {fs.mkdirSync(`${cwd}/cache`) }
    
    // TODO: use file
    fs.writeFileSync(`${cwd}/cache/hevmtemp`, command);
}

function checkStateRepoExistence(statePath, cwd) {
    try { !fs.accessSync(`${cwd}/${statePath}`) }
    catch (e) { resetStateRepo(statePath, cwd) }
}

/**Reset state repo
 * 
 * Hevm state is stored within a local git repository, to reset the state 
 * we must delete the repository then init a new one.
 * 
 * TODO: Windows compatibility
 * @param statePath 
 */
 function resetStateRepo(statePath, cwd) {
    console.log("Creating state repository...")
    console.log(cwd)
    
    const fullPath = cwd + "/" + statePath;
    
    // delete old state
    try{ fs.rmSync(fullPath, {recursive:true}) } 
    catch (e){console.log("Cache didn't exist")};

    // check if a cache folder exists
    try { !fs.accessSync(`${cwd}/cache`) }
    catch (e) {fs.mkdirSync(`${cwd}/cache`) }
    fs.mkdirSync(fullPath);

    
    const initStateRepositoryCommand = `git init && git commit --allow-empty -m "init"`;
    execSync(initStateRepositoryCommand, {cwd: fullPath})
    console.log("Created state repository...")
  }
  

  /**Compile
 * 
 * @param {String} sourceDirectory The location in which the users workspace is - where the child processes should be executed
 * @param {String} fileName 
 * @returns 
 */
function compile(sourceDirectory, fileName) {
    console.log("Compiling contract...")

    // hack - relative imports would not work, force flatten
    // let fileText = fs.readFileSync(`${sourceDirectory}/${fileName}`).toString();
    // const flatten = getImports(fileText).map(file => fs.readFileSync(file.replace(`#include ".`, `${sourceDirectory}`).replace('"','')).toString()).join("\n")
    // fileText = fileText.replace(/#include.*$/gm, '')
    // fileText = flatten.concat(fileText);

    // console.log(fileText)
    // const { bytecode} = compileHuff({
    //     filePath: "",
    //     generateAbi: true,
    //     content: fileText
    // })

    // having issues with the function level debugger
    const command = `huffc ${fileName} --bytecode`
    console.log(command)
    console.log(sourceDirectory)
    const bytecode = execSync(command, {cwd: sourceDirectory});
    return `0x${bytecode.toString()}`;
}


/**Compile Macro
 * 
 * TODO: don't assume that the current macro is located at cache/tempMacro.huff
 * 
 * Returns the compiled macro's bytecode
 * 
 * @param {String} source Macro sourcecode
 * @returns {String} bytecode - Bytecode string returned by the huff compiler
 */
 const compileMacro = (source) => {
    const { bytecode, runtimeBytecode} = compileHuff({
      filePath: "",
      generateAbi: false,
      content: source
    })

    return {
      bytecode: `0x${bytecode.toString()}`,
      runtimeBytecode: `0x${runtimeBytecode.toString()}`
    }
}


/**Write Macro
 * 
 * Write macro into a temporary file location so that it 
 * can be compiled using huffc
 * 
 * @param {String} cwd 
 * @param {String} tempMacroFilename 
 * @param {String} macro 
 */ 
function writeMacro(cwd, tempMacroFilename, macro) {
    fs.writeFileSync(`${cwd}/${tempMacroFilename}.huff`, macro);
}
  

/**Check Hevm Installation
 * 
 * Uses command-exists package to check for hevm installation
 * throw error if not found
 */
async function checkHevmInstallation() {
    try{
        await commandExists("hevm");
        return true;
    } catch (e){
        //TODO: Show something to the user that lets them know that hevm is not installed and
        // that they are required to install it
        
        vscode.window.showErrorMessage(
            "Hevm installation required - install here: https://github.com/dapphub/dapptools#installation"
        )
        return false;
    }
}


module.exports = {
    deployContract,
    runInUserTerminal,
    compile,
    writeMacro,
    checkHevmInstallation,
    writeHevmCommand,
    resetStateRepo,
    checkStateRepoExistence,
    compileMacro
}