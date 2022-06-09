const vscode = require("vscode");
const { functionSignatureExtractor, camelToSnakeCase } = require("./utils");

/**Generate switch table
 * 
 * Read all of the public function definitions and automatically generate a switch table with 
 * references to these functions
 * 
 * @param {*} document - The currently open vscode file
 * @param {*} asJson 
 */
async function generateSwitchTable(document, asJson) {
    let {sighashes, collisions} = functionSignatureExtractor(document.getText());

    if (collisions.length){
        vscode.window.showErrorMessage("Function sighash collisions detected " + collisions.join(","));
    }

    console.log(sighashes)

    let content;
    if (asJson) {
        content = JSON.stringify(sighashes);
    }
    else {
        content = "#define macro MAIN() = takes(0) returns(0) {\n\t0x00 calldataload 0xE0 shr\n"
        for (let hash in sighashes){
            content += `\tdup1 0x${hash} eq ${sighashes[hash].split("(")[0]} jumpi\n`
        }
        content += "\n"
        for (let hash in sighashes){
            const name = sighashes[hash].split("(")[0];
            content += `\t${name}:\n\t\t${camelToSnakeCase(name).toUpperCase()}()\n`
        }
        content += "\t0x00 0x00 revert\n}"
    }
    vscode.workspace.openTextDocument({content, language: "huff"})
        .then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside))
}


module.exports = {
    generateSwitchTable
}