const vscode = require("vscode");
const { generateSwitchTable, generateEventSignatures } = require("./features/commands");
const { provideHoverHandler } = require("./features/hover/index");
const { LANGUAGE_ID } = require("./settings");

let activeEditor;

// View Providers
const { MacroDebuggerViewProvider } = require("./features/debugger/macro/macroDebuggerViewProvider");
const { DebuggerViewProvider } = require("./features/debugger/function/functionDebuggerViewProvider");

/**Activate
 * 
 * Initialise extension commands
 * 
 * @param {vscode.ExtensionContext} context Vscode context 
 */
function activate(context){
    const active =  vscode.window.activeTextEditor;
    activeEditor = active;

    vscode.languages.registerHoverProvider(LANGUAGE_ID, {
        provideHover(document, position, token){
            return provideHoverHandler(document, position, token, LANGUAGE_ID)
        },
    })

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
    const interfaceSignatureGenerator = vscode.commands.registerCommand(
        "huff.tools.eventSignatureGenerator",
        (doc, asJson) => {
            generateEventSignatures(doc || vscode.window.activeTextEditor.document, asJson);
        }
    )

    // Register commands
    context.subscriptions.push(switchGenerator);
    context.subscriptions.push(interfaceSignatureGenerator);
}


module.exports = {
    activate
}