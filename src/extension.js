const vscode = require("vscode");
const { generateSwitchTable } = require("./features/commands");

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

    // Register commands
    context.subscriptions.push(switchGenerator);
}

module.exports = {
    activate
}