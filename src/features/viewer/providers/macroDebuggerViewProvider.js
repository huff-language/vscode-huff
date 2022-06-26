const vscode = require("vscode");

const {getNonce} = require("./utils");
const {getMacros, getImports} = require("../../utils");
const {startMacroDebugger} = require("../macroDebugger");


/**Macro Debugger View Provider
 * 
 * Macro level debug webview
 */
class MacroDebuggerViewProvider{

    static viewType = "huff.debugMacro";

    constructor(extensionUri){
        this._extensionURI = extensionUri;   
        this._view = null;     
    }

    resolveWebviewView(
        webviewView,
        context,
        _token
    ){

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionURI
            ]
        }

        webviewView.webview.html = this.getHtmlForWebView(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case "loadMacros":{
                    const macros = getMacros(vscode.window.activeTextEditor?.document.getText());
                    this.addMacrosToOptions(macros);
                    break;
                }
                case "start-macro-debug": {
                    const {macro, argsArr} = data.values;

                    // get required file imports to flatten the file
                    const imports = getImports(vscode.window.activeTextEditor?.document.getText())
                    
                    // TODO: get config from radio buttons
                    startMacroDebugger(
                        vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri.path, 
                        vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri), 
                        imports, 
                        macro, 
                        argsArr, 
                        {});
                }
            }
        });


        this._view = webviewView;
    }

    addMacrosToOptions(macros){
        if (this._view){
            this._view.show?.(true);
            this._view.webview.postMessage({ type: "receiveMacros", data: macros })
        }
    }

    getHtmlForWebView(webview) {
        // local path of main script to run in the webview

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "macro.main.js"));

        // Do the same for the stylesheet
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "main.css"));

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

                        <ul class="stack-items">
                        </ul>

                        <button class="start-debug">Start Debug</button>
                        <script nonce="${nonce}" src="${scriptUri}"></script>
                     </body>
                </html>`;
        
    }
}


module.exports = {
    MacroDebuggerViewProvider
}