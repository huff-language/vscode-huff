const vscode = require("vscode");
const { generateSwitchTable } = require("./features/commands");
const { functionSignatureExtractor, getFunctionSignaturesAndArgs, getMacros, getImports } = require("./features/utils");
const { startDebugger, startMacroDebugger } = require("./features/viewer/debugger");
// const { DebuggerViewProvider } = require("./features/viewer/debugger");

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


class DebuggerViewProvider{

    static viewType = "huff.debugView";

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
            console.log(data)
            switch (data.type) {
                case "loadDocument":{
                    const functionSignatures = getFunctionSignaturesAndArgs(vscode.window.activeTextEditor?.document.getText());
                    this.addOptionsToFunctionSelector(functionSignatures.sighashes);
                    break;
                }
                case "start-debug": {
                    const {selectedFunction, argsArr} = data.values;
                    console.log("selectedFunc", selectedFunction)
                    console.log("argsArr", argsArr)

                    // TODO: get config from radio buttons
                    startDebugger(
                        vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri.path, 
                        vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri), 
                        selectedFunction, 
                        argsArr, 
                        {}
                    );
                }
            }
        });


        this._view = webviewView;
    }

    addOptionsToFunctionSelector(functionSelectors){
        if (this._view){
            this._view.show?.(true);
            this._view.webview.postMessage({ type: "receiveContractInterface", data: functionSelectors })
        }
    }

    addColor() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'addColor' });
		}
	}

	clearColors() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'clearColors' });
		}
	}

    getHtmlForWebView(webview) {
        // local path of main script to run in the webview

        console.log(this._extensionURI)
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "main.js"));

        // Do the same for the stylesheet
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "main.css"));
        console.log(scriptUri)

        // Use nonce to allow only a specific script to be run
        const nonce = getNonce();
        console.log(nonce)

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
                        <button class="load-interface">Load interface</button>

                        <select id="function-select">
                        </select>

                        
                        <ul class="args-inputs">
                        </ul>
                        
                        <button class="start-debug">Start Debug</button>
                        
                        <script nonce="${nonce}" src="${scriptUri}"></script>
                     </body>
                </html>`;
        
    }
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

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
            console.log(data)
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
                    
                    console.log("imports")
                    console.log(imports)
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

        console.log(this._extensionURI)
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "macro.main.js"));

        // Do the same for the stylesheet
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "media", "main.css"));
        console.log(scriptUri)

        // Use nonce to allow only a specific script to be run
        const nonce = getNonce();
        console.log(nonce)

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

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}


module.exports = {
    activate
}