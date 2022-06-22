const vscode = require("vscode");
const ethers = require("ethers");
const fs = require("fs");
const {execSync} = require("child_process");
const { AbiCoder } = require("ethers/lib/utils");


// TODO: must install the huffc compiler if it does not exists on the system

async function startDebugger(sourceDirectory, currentFile, functionSelector, argsObject, options={state:true}){

  const config = {
    // Create deterministic deployment address for each contract
    hevmContractAddress: ethers.utils.keccak256(Buffer.from(currentFile)).toString().slice(0,42),
    hevmCaller: "0x0000000000000000000000000000000000000069",
    statePath: "cache/huff_debug_hevm_state"
  }

  const calldata = await prepareDebugTransaction(functionSelector, argsObject, config);
  const bytecode = compile(sourceDirectory, currentFile);

  //TODO: make this only happen with the state option set!
  // if (options.state){
    // create the state repository if it does not exist yet
    if (config.statePath && !fs.existsSync(config.statePath)){
      resetStateRepo(config.statePath, sourceDirectory)}
  // }

  const deployedBytecode = deployContract(bytecode, config, sourceDirectory);
  runDebugger(deployedBytecode, calldata,  options, config, sourceDirectory)
}

// TODO: COMBINE THiS and above function into one 
async function startMacroDebugger(sourceDirectory, currentFile, imports, macro, argsObject, options={state:true}){
  const config = {
    // Create deterministic deployment address for each contract
    hevmContractAddress: ethers.utils.keccak256(Buffer.from(macro.toString())).toString().slice(0,42),
    hevmCaller: "0x0000000000000000000000000000000000000069",
    statePath: "cache/huff_debug_hevm_state"
  }

  const compilableMacro = createCompiledMacro(sourceDirectory, macro, argsObject, currentFile, imports);
  
  writeMacro(sourceDirectory, compilableMacro)

  const macroBytecode = compileMacro(sourceDirectory)
  
  // deploy the contract to get the runtime code to debug against
  const bytecode = deployMacro(macroBytecode, config, sourceDirectory);

  runMacroDebugger(bytecode, config, sourceDirectory);
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
const createCompiledMacro = (cwd, macro, argsObject, currentFile, imports) => {
  const compilableMacro = `
  #include "${cwd}/${currentFile}"
  ${imports.map(file => file.replace('".', `"${cwd}`)).join("\n")}
  #define macro MAIN() = takes(0) returns (0) {
    ${argsObject.join(" ")}
    ${macro.body}
  }`;
  return compilableMacro
}

const writeMacro = (cwd, macro) => {
  fs.writeFileSync(cwd + "/cache/tempMacro.huff", macro);
}

const compileMacro = (sourceDirectory) => {
  const command = `npx huffc ${sourceDirectory}/cache/tempMacro.huff --bytecode`;
  const bytecode = execSync(command, {cwd: sourceDirectory});
  return `0x${bytecode.toString()}`;
}

const deployMacro = (bytecode, config, cwd) => {
  //0xf7f30b7630DCf3b7F920Be7D9c46b8B632Dd103f - test addr

    const command = `hevm exec
    --code ${bytecode} \
    --address ${config.hevmContractAddress} \
    --create \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    `
    // cache command
    fs.writeFileSync(cwd + "/cache/hevmtemp", command, {cwd});
    
    // execute command
    return execSync("`cat " + cwd + "/cache/hevmtemp`")
  }

/**Deploy Contract
 * Deploy the contract to perform constructor operations 
 * 
 * @param {String} bytecode 
 * @param {Object<value: String>} config 
 * @returns 
 */
const deployContract = (bytecode, config, cwd) => {
  //0xf7f30b7630DCf3b7F920Be7D9c46b8B632Dd103f - test addr

    const command = `hevm exec
    --code ${bytecode} \
    --address ${config.hevmContractAddress} \
    --create \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    --state ${cwd + "/" + config.statePath}
    `
    // cache command
    fs.writeFileSync(cwd + "/cache/hevmtemp", command, {cwd});
    
    // execute command
    return execSync("`cat " + cwd + "/cache/hevmtemp`")
  }


  const runMacroDebugger = (bytecode, config, cwd) => {

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
  
  const runDebugger = (bytecode, calldata, flags, config, cwd) => {
    console.log("Entering debugger...")
    
    if (flags){
        if (flags.reset){
          resetStateRepo(config.statePath)}
    }
    
      // Command
    const command = `hevm exec \
    --code ${bytecode} \
    --address ${config.hevmContractAddress} \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    ${(flags.state) ? ("--state "+ cwd + "/" + config.statePath)  : ""} \
    --debug \
    --calldata ${calldata}`
    
    // command is cached into a file as execSync has a limit on the command size that it can execute
    fs.writeFileSync(cwd + "/cache/hevmtemp", command, {cwd});
   
    // TODO: run the debugger - attach this to a running terminal
    runInUserTerminal("`cat " + cwd + "/cache/hevmtemp`")
    // execSync("`cat " + cwd + "/cache/hevmtemp`", {stdio: ["inherit", "inherit", "inherit"], cwd})
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

async function prepareDebugTransaction(functionSelector, argsObject, config){
    console.log("Preparing debugger calldata...")
    // TODO: error handle with user prompts
    const abiEncoder = new AbiCoder()

    // create interface readable by the abi encoder
    let type = [];
    let value = [];
    argsObject.forEach(arg => {
      type.push(arg[0]);
      value.push(arg[1]);
    });

    const encoded = abiEncoder.encode(type,value);

    return `0x${functionSelector[0]}${encoded.slice(2, encoded.length)}`
}

/**Compile
 * 
 * @param {String} sourceDirectory The location in which the users workspace is - where the child processes should be executed
 * @param {String} fileName 
 * @returns 
 */
function compile(sourceDirectory, fileName) {
    console.log("Compiling contract...")
    // TODO: install huffc locally if it doesnt exist and run with npx 

    const command = `npx huffc ${fileName} --bytecode`;
    const bytecode = execSync(command, {cwd: sourceDirectory});
    return `0x${bytecode.toString()}`;
}


/**Reset state repo
 * 
 * Hevm state is stored within a local git repository, to reset the state 
 * we must delete the repository then init a new one.
 * 
 * TODO: Windows compatibility
 * @param statePath 
 */
 const resetStateRepo = (statePath, cwd) => {
  console.log("Creating state repository...")

  const removeStateCommand = `rm -rf ${statePath}`;
  const createStateRepository = `mkdir ${statePath}`;
  const initStateRepositoryCommand = `cd ${statePath} && git init && git commit --allow-empty -m "init" && cd ..`;

  execSync(removeStateCommand, {cwd})
  execSync(createStateRepository, {cwd})
  execSync(initStateRepositoryCommand, {cwd})
  console.log("Created state repository...")
}

module.exports = {
    startDebugger,
    startMacroDebugger
}