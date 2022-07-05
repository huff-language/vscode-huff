const vscode = require("vscode");

/**Get Nonce()
 * 
 * Provide a nonce when running webview
 * 
 * @returns {String}
 */
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

/**Check calldata is hex
 * 
 * @param {String} val 
 * @returns 
 */
function checkCalldataIsHex(val){
	if (!isHex(val)){
		vscode.window.showErrorMessage(`Could not run debugger.\nProvided calldata value ${val} is not hex, please convert to hex and try again.`);
		return false;
	}
	return true;
}

/**Check inputs are hex
 * 
 * @param {Array<String>} argsArr 
 * @returns 
 */
function checkInputIsHex(argsArr){
	for (const arg of argsArr){
		if (!isHex(arg)){
    		vscode.window.showErrorMessage(`Could not run debugger.\nStack input ${arg} is not hex, please convert to hex and try again.`);
			return false;
		}
	}
	return true;
}

/**Is Hex
 * 
 * @param {String} val 
 * @returns {Boolean} the calldata to be called with
 */
function isHex(val){
	return Boolean(val.match(/^0x[0-9a-f]+$/i))
}

module.exports = {
    getNonce,
	checkInputIsHex,
	checkCalldataIsHex
}