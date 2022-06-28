const vscode = require("vscode");
const ethers = require("ethers"); 
const fs = require("fs");
const {execSync} = require("child_process");
const { AbiCoder } = require("ethers/lib/utils");
const { hevmConfig } = require("../../options");
const { deployContract, checkHevmInstallation, runInUserTerminal, compile } = require("./utils");


// TODO: must install the huffc compiler if it does not exists on the system

/**Start function debugger 
 * 
 * @param {String} sourceDirectory The current working directory of selected files workspace
 * @param {String} currentFile The path to the currently selected file
 * @param {String} functionSelector The 4byte function selector of the transaction being debugged
 * @param {Array<Array<String>>} argsArray Each arg is provided in the format [type, value] so that they can easily be parsed with abi encoder
 * @param {Object} options Options - not explicitly defined 
 */
async function startDebugger(sourceDirectory, currentFile, functionSelector, argsArray, options={state:true}){
  if (!(await checkHevmInstallation())) return;

  
  // Create deterministic deployment address for each contract for the deployed contract
  const config = {
    ...hevmConfig,

    //TODO: convert this to NOT use ethers to reduce extensions footprint
    hevmContractAddress: ethers.utils.keccak256(Buffer.from(currentFile)).toString().slice(0,42),
  }

  const calldata = await prepareDebugTransaction(functionSelector, argsArray, config);
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

  
function runDebugger(bytecode, calldata, flags, config, cwd) {
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
  ${calldata ? "--calldata ${calldata}" : ""}`
  
  // command is cached into a file as execSync has a limit on the command size that it can execute
  fs.writeFileSync(cwd + "/cache/hevmtemp", command, {cwd});
  
  // TODO: run the debugger - attach this to a running terminal
  runInUserTerminal("`cat " + cwd + "/cache/hevmtemp`")
  // execSync("`cat " + cwd + "/cache/hevmtemp`", {stdio: ["inherit", "inherit", "inherit"], cwd})
}


/**Prepare Debug Transaction
 * 
 * Use abi encoder to encode transaction data
 * 
 * @param {String} functionSelector 
 * @param {Array<Array<String>} argsObject 
 * @param {Object} config 
 * @returns 
 */
async function prepareDebugTransaction(functionSelector, argsObject, config){
    console.log("Preparing debugger calldata...")
    if (argsObject.length == 0) return null;

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

  const removeStateCommand = `rm -rf ${statePath}`;
  const createStateRepository = `mkdir ${statePath}`;
  const initStateRepositoryCommand = `cd ${statePath} && git init && git commit --allow-empty -m "init" && cd ..`;

  execSync(removeStateCommand, {cwd})

  // check if a cache folder exists
  if (!fs.existsSync(cwd + "/cache")){
    fs.mkdirSync(cwd + "/cache")}

  execSync(createStateRepository, {cwd})
  execSync(initStateRepositoryCommand, {cwd})
  console.log("Created state repository...")
}


module.exports = {
  startDebugger
}
