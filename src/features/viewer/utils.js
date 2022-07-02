const vscode = require("vscode");
const commandExists = require("command-exists");
const fs = require("fs");
const {execSync} = require("child_process");
const {default: compileHuff} = require("huffc");


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
    fs.writeFileSync(`${cwd}/${file}`, command);
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

function compileFromFile(source, filename, cwd) {
    writeHevmCommand(source, filename, cwd);
    const command = `huffc ${filename} --bytecode`
    const bytecode = execSync(command, {cwd: cwd});
    return `0x${bytecode.toString()}`;
}

/**Write source to temp file
 * 
 * @param {String} source 
 * @param {String} filename 
 * @param {String} cwd 
 */
function createTempFile(source, filename, cwd){
    fs.writeFileSync(`${cwd}/${filename}`, source);
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
        registerError(
            e,
            "Hevm installation required - install here: https://github.com/dapphub/dapptools#installation"
        )       
        return false;
    }
}

/**Check huff installation
 * 
 * Uses command-exists package to check for huffc installation
 * This is required until web assembly version is created
 * @returns 
 */
async function checkHuffcInstallation() {
    try{
        await commandExists("huffc");
        return true;
    } catch (e){ 
        registerError(
            e,
            "Huffc compiler installation required - install here: https://github.com/huff-language/huff-rs"
        )       
        return false;
    }
}

async function checkInstallations(){
    const results = await Promise.all([
        checkHevmInstallation(),
        checkHuffcInstallation
    ]);
    return results.every(result => result);
}

/**Register Error
 * 
 * Log an error and display it to the user
 * 
 * @param {Exception} e 
 * @param {String} message 
 */
async function registerError(e, message) {
    vscode.window.showErrorMessage(`${message}\nError Message:\n${e}`);
    console.error(e);
}


module.exports = {
    deployContract,
    runInUserTerminal,
    compile,
    writeMacro,
    writeHevmCommand,
    resetStateRepo,
    checkStateRepoExistence,
    compileMacro,
    registerError,
    compileFromFile,
    checkInstallations
}