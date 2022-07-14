const vscode = require("vscode");

const {getNonce, checkInputIsHex, checkCalldataIsHex} = require("../providerUtils");
const {getMacros, getImports} = require("../../regexUtils");
const {startMacroDebugger} = require("./macroDebugger");
const { LANGUAGE_ID} = require("../../../settings");


/**Macro Debugger View Provider
 * 
 * Macro level debug webview
 */
class MacroDebuggerViewProvider{

    static viewType = "huff.debugMacro";

    constructor(extensionUri){
        this._extensionURI = extensionUri;   
        this._view = null;
        this._macros = null;
        this._currentFile = null; 
    }

    /**
     * 
     * @param {*} webviewView 
     * @param {} context 
     * @param {*} _token 
     */
    resolveWebviewView(
        webviewView,
        context,
        _token
    ){
        // get the last active file
        if (!this._currentFile) this._currentFile = context.state.currentFile || null;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionURI
            ]
        }

        // Get macros from the file
        vscode.workspace.onDidSaveTextDocument((document) => {
            // check the file type and only run on the current file
            if (
                document.languageId === LANGUAGE_ID 
                && document.uri.scheme === "file" 
                && document.uri.path === this._currentFile 
            ) {
                this._macros = getMacros(vscode.window.activeTextEditor?.document.getText());
            }
        })

        webviewView.webview.html = this.getHtmlForWebView(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case "loadMacros":{
                    const macros = getMacros(vscode.window.activeTextEditor?.document.getText());
                    const activeFile = vscode.window.activeTextEditor?.document.uri.path;
                    this._currentFile = activeFile;
                    this._macros = macros;
                    this.addMacrosToOptions(macros, activeFile);
                    break;
                }
                case "start-macro-debug": {
                    const {
                        macro, 
                        argsArr, 
                        stateChecked, 
                        calldataChecked, 
                        calldataValue,
                        storageChecked,
                        stateValues
                    } = data.values;

                    console.log(macro)
                    
                    // Get the full macro body
                    const macroBody = this._macros[macro];
                    
                    // Prevent debugging and show an error message if the stack inputs are not hex
                    if (!checkInputIsHex(argsArr)) break;
                    if (calldataChecked &&!checkCalldataIsHex(calldataValue)) break;

                    // get required file imports to flatten the file
                    const imports = getImports(vscode.window.activeTextEditor?.document.getText())
                    
                    startMacroDebugger(
                        vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri.path, 
                        vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri), 
                        imports, 
                        macroBody, 
                        argsArr, 
                        {
                            stateChecked,
                            calldataChecked,
                            calldataValue,
                            storageChecked,
                            stateValues
                        });
                }
            }
        });


        this._view = webviewView;
    }

    addMacrosToOptions(macros, currentFile){
        if (this._view){
            this._view.show?.(true);
            this._view.webview.postMessage({ type: "receiveMacros", data: macros, currentFile })
        }
    }

    updateSavedMacros(macros){
        if (this._view){
            this._view.show?.(true);
            this._view.webview.postMessage({ type: "updateMacros", data: macros })
        }
    }

    getHtmlForWebView(webview) {
        // local path of main script to run in the webview

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "macro", "macro.main.js"));
        const helpersUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "helpers.js"));

        // Do the same for the stylesheet
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "css", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "css", "main.css"));

        // Use nonce to allow only a specific script to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <!--
                            Use a content security policy to only allow loading images from https or from our extension directory,
                            and only allow scripts that have a specific nonce.
                        -->
                        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">

                        <link href="${styleVSCodeUri}" rel="stylesheet">
                        <link href="${styleMainUri}" rel="stylesheet">
                                              
                        <title>Huff Debugger</title>
                    </head>
                    <body>
                        <button class="load-macro">Load Macros</button>

                        <select id="macro-select">
                        </select>

                        <ol class="stack-items">
                        </ol>

                        <!-- Have a checkbox button to operate with state -->
                        <form>
                            <input class="calldata-checkbox" type="checkbox" id="calldata-checkbox" name="calldata-checkbox">
                            <label for="calldata-checkbox">With Calldata</label>
                            </br>
                            <input class="calldata-input" type="text" id="calldata-input" value="Enter Calldata">
  
                            </br>
                            <input class="storage-checkbox" type="checkbox" id="storage-checkbox" name="storage-checkbox">
                            <label for="storage-checkbox">Storage Overrides</label>
                            
                        </form>

                        
                        </br>                       
                        <ul id="storage-overrides">
                        </ul>
                        <button id="add-slot">Add slot</button>

                        <button class="start-debug">Start Debug</button>
                        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
                        <script type="module" nonce="${nonce}" src="${helpersUri}"></script>
                     </body>
                </html>`;
        
    }
}


module.exports = {
    MacroDebuggerViewProvider
}