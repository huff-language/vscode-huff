const vscode = require("vscode");
const { generateSwitchTable, generateEventSignatures } = require("./features/commands");

/**Activate
 * 
 * Initialise extension commands
 * 
 * @param {*} context Vscode context 
 */
function activate(context){

    // Generate a switch table from huff interface definitions
    const switchGenerator = vscode.commands.registerCommand(
        "huff.tools.switchgenerator",
        (doc, asJson) => {
            generateSwitchTable(doc || vscode.window.activeTextEditor.document, asJson);
        }
    )
    const interfaceSignatureGenerator = vscode.commands.registerCommand(
        "huff.tools.eventSignatureGenerator",
        (doc, asJson) => {
            generateEventSignatures(doc || vscode.window.activeTextEditor.document, asJson);
        }
    )

    // Register commands
    context.subscriptions.push(switchGenerator);
    context.subscriptions.push(eventSignatureGenerator);
}

module.exports = {
    activate
}