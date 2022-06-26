const vscode = require("vscode");

const {getNonce} = require("./utils");
const {startDebugger} = require("../debugger");
const {getFunctionSignaturesAndArgs} = require("../../utils");


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
            switch (data.type) {
                case "loadDocument":{
                    const functionSignatures = getFunctionSignaturesAndArgs(vscode.window.activeTextEditor?.document.getText());
                    this.addOptionsToFunctionSelector(functionSignatures.sighashes);
                    break;
                }
                case "start-debug": {
                    const {selectedFunction, argsArr} = data.values;

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
		if (this._vew) {
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
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "functions.main.js"));

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

module.exports = {
    DebuggerViewProvider
}