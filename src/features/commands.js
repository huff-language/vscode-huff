const vscode = require("vscode");
const { functionSignatureExtractor, eventSignatureExtractor, toUpperSnakeCase } = require("./regexUtils");

/**Generate switch table
 * 
 * Read all of the public function definitions and automatically generate a switch table with 
 * references to these functions
 * 
 * @param {*} document - The currently open vscode file
 * @param {*} asJson 
 */
async function generateSwitchTable(document, asJson) {
    let {sigHashes, collisions} = functionSignatureExtractor(document.getText());

    if (collisions.length){
        vscode.window.showErrorMessage("Function sigHash collisions detected " + collisions.join(","));
    }

    let content;
    if (asJson) {
        content = JSON.stringify(sigHashes);
    }
    else {
        // Create MAIN macro
        content = "#define macro MAIN() = takes(0) returns(0) {\n\t0x00 calldataload 0xE0 shr\n"
        
        // Create jumps
        for (let hash in sigHashes){
            content += `\tdup1 0x${hash} eq ${sigHashes[hash].split("(")[0]} jumpi\n`
        }
        content += "\n"
        
        // Create dispatch statements
        for (let hash in sigHashes){
            const name = sigHashes[hash].split("(")[0];
            content += `\t${name}:\n\t\t${toUpperSnakeCase(name)}()\n`
        }

        // No default fallback
        content += "\t0x00 0x00 revert\n}"
    }

    outputContentToSideEditor(content);
}


/**Generate Event Signatures
 * 
 * Similar to generating function signatures above, but this command generates 32 byte event topics.
 * 
 * @param {*} document 
 * @param {*} asJson 
 */
async function generateEventSignatures(document, asJson) {
    let {sigHashes, collisions } = eventSignatureExtractor(document.getText())

    if (collisions.length){
        vscode.window.showErrorMessage("Function sigHash collisions detected " + collisions.join(","));
    }

    let content = "";
    if (asJson) {
        content = JSON.stringify(sigHashes);
    }
    else {
        for (let hash in sigHashes){             
            const name = sigHashes[hash].split("(")[0];
            
            // Output each resultant hash into new editor
            content += `#define constant ${toUpperSnakeCase(name)}_SIGNATURE = 0x${hash}\n`
        }
    }

    outputContentToSideEditor(content)
}

/**Output Content to Side Editor
 * 
 * Output the result of a command to a new vscode editor window
 * 
 * @param {*} content 
 */
function outputContentToSideEditor(content){
    vscode.workspace.openTextDocument({content, language: "huff"})
        .then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)) 
}


module.exports = {
    generateSwitchTable,
    generateEventSignatures,
    outputContentToSideEditor
}