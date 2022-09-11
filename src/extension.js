const vscode = require("vscode");
const {
  generateSwitchTable,
  generateEventSignatures,
} = require("./features/commands");
const { provideHoverHandler } = require("./features/hover/index");
const { LANGUAGE_ID, EXTENSION_NAME } = require("./settings");
const { CodeLensProvider } = require("./features/codelens/codelens");

let activeEditor;

// View Providers
const {
  MacroDebuggerViewProvider,
} = require("./features/debugger/macro/macroDebuggerViewProvider");
const {
  DebuggerViewProvider,
} = require("./features/debugger/function/functionDebuggerViewProvider");
const {
  renderAnnotatedStack,
} = require("./features/codelens/renderAnnotatedStack");

/**Activate
 *
 * Initialise extension commands
 *
 * @param {vscode.ExtensionContext} context Vscode context
 */
function activate(context) {
  const active = vscode.window.activeTextEditor;
  activeEditor = active;

  vscode.languages.registerHoverProvider(LANGUAGE_ID, {
    provideHover(document, position, token) {
      return provideHoverHandler(document, position, token, LANGUAGE_ID);
    },
  });

  // Register the debug webview
  const debugProvider = new DebuggerViewProvider(context.extensionUri);
  const macroDebugProvider = new MacroDebuggerViewProvider(
    context.extensionUri
  );

  // functions debugger
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DebuggerViewProvider.viewType,
      debugProvider
    )
  );

  // macros debugger
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MacroDebuggerViewProvider.viewType,
      macroDebugProvider
    )
  );

  // Generate a switch table from huff interface definitions
  const switchGenerator = vscode.commands.registerCommand(
    "huff.tools.switchgenerator",
    (doc, asJson) => {
      generateSwitchTable(
        doc || vscode.window.activeTextEditor.document,
        asJson
      );
    }
  );
  const interfaceSignatureGenerator = vscode.commands.registerCommand(
    "huff.tools.eventSignatureGenerator",
    (doc, asJson) => {
      generateEventSignatures(
        doc || vscode.window.activeTextEditor.document,
        asJson
      );
    }
  );

  const stackInspector = vscode.commands.registerCommand(
    // TODO: make constant?
    "huff.tools.stackInspector",
    renderAnnotatedStack
  );

  // Register commands
  // Table generation
  context.subscriptions.push(switchGenerator);
  context.subscriptions.push(interfaceSignatureGenerator);

  // Stack inspector
  context.subscriptions.push(stackInspector);

  // Activate codelens
  const codelensProvider = new CodeLensProvider();
  vscode.languages.registerCodeLensProvider(LANGUAGE_ID, codelensProvider);

  vscode.commands.registerCommand(`${EXTENSION_NAME}.enableCodeLens`, () => {
    workspace
      .getConfiguration(EXTENSION_NAME)
      .update("enableCodeLens", true, true);
  });

  vscode.commands.registerCommand(`${EXTENSION_NAME}.disableCodeLens`, () => {
    workspace
      .getConfiguration(EXTENSION_NAME)
      .update("enableCodeLens", false, true);
  });

  vscode.commands.registerCommand(
    `${EXTENSION_NAME}.codelensAction`,
    (args) => {
      window.showInformationMessage(
        `CodeLens action clicked with args=${args}`
      );
    }
  );
}

module.exports = {
  activate,
};
