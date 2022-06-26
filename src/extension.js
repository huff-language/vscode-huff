const vscode = require("vscode");
const { generateSwitchTable } = require("./features/commands");

// View Providers
const { MacroDebuggerViewProvider } = require("./features/viewer/providers/macroDebuggerViewProvider");
const { DebuggerViewProvider } = require("./features/viewer/providers/functionDebuggerViewProvider");

/**Activate
 * 
 * Initialise extension commands
 * 
 * @param {*} context Vscode context 
 */
function activate(context){

    // Register the debug webview
    const debugProvider = new DebuggerViewProvider(context.extensionUri);
    const macroDebugProvider = new MacroDebuggerViewProvider(context.extensionUri);

    // functions debugger
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DebuggerViewProvider.viewType, debugProvider));

    // macros debugger
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(MacroDebuggerViewProvider.viewType, macroDebugProvider));


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