// Extension Options
// 
// TODO: configuration object - these options should be changeable within the vscode settings editor


/**Hevm Config
 * 
 * Options relating tho the config of the hevm debugger - the majority of these options can be 
 * altered by the end user within huff langs vscode extension settings
 */
const hevmConfig = {
    // Deterministic deployment address for each contract is calculated at deploy time
    hevmContractAddress: null,

    // The address that will be *signing* the debugger transactions
    // This can be altered by the user within the extension's side panel UI
    hevmCaller: "0x00000000000000000000000000000000000000420",

    // The path at which hevm state will be stored
    // In order for hevm to maintain contract storage between transactions a path to a state git repository
    // must be provided. The default location is provided below, it will be able to be changed within the
    // the extension's settings.
    statePath: "cache/huff_debug_hevm_state",
    
    // When macros are debugged, they are written to a temp location to be compiled
    tempMacroFilename: "cache/tempMacro"
}


module.exports  = {
    hevmConfig
}