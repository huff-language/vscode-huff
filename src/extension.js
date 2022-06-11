const vscode = require("vscode");
const { generateSwitchTable } = require("./features/commands");
const { provideHoverHandler } = require("./features/hover/index");
const { LANGUAGE_ID } = require("./settings");

let activeEditor;

/**Activate
 * 
 * Initialise extension commands
 * 
 * @param {*} context Vscode context 
 */
function activate(context){
    const active =  vscode.window.activeTextEditor;
    activeEditor = active;

    vscode.languages.registerHoverProvider(LANGUAGE_ID, {
        provideHover(document, position, token){
            return provideHoverHandler(document, position, token, LANGUAGE_ID)
        },
    })

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