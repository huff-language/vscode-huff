const vscode = require("vscode");
const commandExists = require("command-exists");
const fs = require("fs");
const {execSync, spawnSync} = require("child_process");


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
    cwd
  ) {
    if (config.stateChecked || config.storageChecked){
        console.log("resetting state")
        checkStateRepoExistence(config.statePath, cwd)
    }

    const isWsl = vscode.env.remoteName === "wsl";
    const statePath = `${(isWsl) ? "/mnt/c" : ""}${cwd}/${config.statePath}`
    const command = `hevm exec --code ${bytecode} --address ${config.hevmContractAddress} --create --caller ${config.hevmCaller} --gas 0xffffffff ${(config.stateChecked || config.storageChecked)  ? "--state " + statePath : ""}`
    console.log(command)

    // cache command
    writeHevmCommand(command, config.tempHevmCommandFilename, cwd);
    
    // execute command
    // const result = execSync("`cat " + cwd + "/" + config.tempHevmCommandFilename + "`", {cwd: cwd});
    const hevmCommand = craftTerminalCommand(cwd, config.tempHevmCommandFilename);
    try{
        const result = executeCommand(cwd, command)
        console.log(result)
        return result
    }catch (e) {
        console.log("deployment failure")
        console.log(e.message)
        console.log("e.stdout", e.stdout.toString());
        console.log("e.stderr", e.stderr.toString());
        console.log("e.pid", e.pid);
        console.log("e.signal", e.signal);
        console.log("e.status", e.status);
    }
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
    fs.writeFileSync(`${cwd}/${file}`, command);
}


function purgeCache(cwd){
    try { fs.rmSync(`${cwd}/cache`, {recursive:true}) }
    catch (e){console.log("Cache didn't exist")};
}

function checkStateRepoExistence(statePath, cwd) {
    resetStateRepo(statePath, cwd)
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
    const fullPath = cwd + "/" + statePath;
    
    // delete old state
    try{ fs.rmSync(fullPath, {recursive:true}) } 
    catch (e){console.log("Cache didn't exist")};

    // check if a cache folder exists
    try { !fs.accessSync(`${cwd}/cache`) }
    catch (e) {fs.mkdirSync(`${cwd}/cache`) }
    fs.mkdirSync(fullPath);

    
    const initStateRepositoryCommand = `git init`;
    const setHuffAsCommitter = `git config user.name "huff" && git config user.email "huff"`;
    const initCommit = `git commit --allow-empty -m "init"`;
    execSync(initStateRepositoryCommand, {cwd: fullPath})
    execSync(setHuffAsCommitter, {cwd: fullPath})
    execSync(initCommit, {cwd: fullPath})
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
    const bytecode = execSync(command, {cwd: sourceDirectory});
    return `0x${bytecode.toString()}`;
}


/**Compile From File
 * 
 * Write `source` to a file then compile it with the 
 * installed huffc compiler 
 * 
 * @param {String} source 
 * @param {String} filename 
 * @param {String} cwd 
 * @returns 
 */
function compileFromFile(source, filename, cwd) {
    writeHevmCommand(source, filename, cwd);
    
    const command = `huffc ${filename} --bytecode`
    let bytecode;

    // if huffc is not found, then try add huffup to path
    try {
        bytecode = execSync(command, {cwd: cwd });
    } catch (e) {
        try {
            bytecode = executeCommand(cwd, command);
        } catch (e) {
            console.log("huffc not found");
            registerError(
                e,
                "Huffc was not found in the system path, add it to $PATH or install here: https://github.com/huff-language/huff-rs"
            )       
            return false;
        }
    }

    // remove temp file
    // fs.rmSync(`${cwd}/${filename}`); 
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
    return await checkInstallation("hevm");
}

/**Check huff installation
 * 
 * Uses command-exists package to check for huffc installation
 * This is required until web assembly version is created
 * @returns 
 */
async function checkHuffcInstallation() {
    return checkInstallation("hevm")
}


/**Check Installation
 * 
 * Generalise commandExist to support projects that are running in wsl
 * @param {*} command 
 * @returns 
 */
async function checkInstallation(command){
    try {
        // Depending on what enviornment the code is running in, check if a command is installed
        if (vscode.env.remoteName === "wsl") {
            // check installation using unix command executed in wsl
            const exists = spawnSync("wsl", ["bash", "-l", "which", command], {
                shell: true
            });
            // If the std out returns anything, then we can be confident that the exist command succeeded
            if (exists.stdout.length > 1) return true;
        }

        // Fallback to use the commandExists package
        await commandExists(command);
        return true;
    } catch (e){
        registerError(
            e,
            `${command} installation required - install here: ${getInstallationLink(command)}`
        )       
        return false;
    }
}

function craftTerminalCommand(cwd, filename){
    const isWsl = vscode.env.appHost;
    return "`cat " + ((isWsl) && "/mnt/c") + cwd + "/" + filename + "`";
}

/**Execute Command
 * 
 * Exec subprocess respecting wsl 
 * 
 * @param {String} cwd 
 * @param {String} command 
 * @returns 
 */
function executeCommand(cwd, command){
    // Depending on what enviornment the code is running in, check if a command is installed
    if (vscode.env.remoteName === "wsl") {
        // check installation using unix command executed in wsl
        console.log(`wsl bash -l -c "${command}"`)
        
        const output = spawnSync('wsl bash -l -c "' + command + '"', {
            shell: true,
            cwd
        });

        console.log("OUTPUT")
        console.log(output)

        // If the std out returns anything, then we can be confident that the exist command succeeded
        if (output.stdout.length > 1) {
            return output.stdout.toString()
        }
    }
    const output = execSync(command, {
        cwd: cwd, 
        env: {...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.huff/bin`}
    });
    return output.toString();
}

/**Get InstallationLink
 * 
 * Provide a location to install files from if they are not found locally
 * @param {String} command 
 * @returns {String} link
 */
function getInstallationLink(command){
    switch (command){
        case ("huffc") : {
            return "https://github.com/huff-language/huff-rs";
        }
        case ("hevm"): {
            return "https://github.com/dapphub/dapptools#installation";
        }
        default: {
            return "Unsupported command supplied";
        }
    }
}

/**Check Installations
 * 
 * Check for both hevm and huffc installations
 * @returns {Promise<Boolean>} 
 */
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

/**Format even bytes
 * Format a hex literal to make its length even
 * @param {String} bytes
 */
const formatEvenBytes = (bytes) => {
	if (bytes.length % 2) {
	  return bytes.replace("0x", "0x0");
	}
	return bytes;
};


module.exports = {
    deployContract,
    runInUserTerminal,
    compile,
    writeMacro,
    writeHevmCommand,
    resetStateRepo,
    checkStateRepoExistence,
    registerError,
    compileFromFile,
    checkInstallations,
    craftTerminalCommand,
    purgeCache,
    formatEvenBytes
}