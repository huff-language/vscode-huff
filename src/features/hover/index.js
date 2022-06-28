/**
 * @author @sw0nt github.com/Saw-mon-and-Natalie
 * @license MIT
 * @notes original: https://github.com/ConsenSys/vscode-solidity-auditor/blob/master/src/features/hover.js
 *
 * */
const vscode = require("vscode");
const asmArr = require("./asm.json");

function createHover(name, snippet, type) {
  var text = [];

  if (isSet(snippet.instr_args) || isSet(snippet.instr_returns)) {
    text.push(
      "_asm_ :: __" +
        name +
        "__ (" +
        snippet.instr_args.join(", ") +
        ")" +
        (isSet(snippet.instr_returns)
          ? " : " + snippet.instr_returns.join(", ")
          : "")
    );
  }

  if (text.length > 0) {
    text.push("");
  }
  if (isSet(snippet.instr_gas)) {
    text.push("__⟶__ gas (min): " + snippet.instr_gas);
  }
  if (isSet(snippet.instr_fork)) {
    text.push("__⟶__ since: " + snippet.instr_fork);
  }

  if (text.length > 0) {
    text.push("");
  }
  if (isSet(snippet.example)) {
    text.push(snippet.example);
  }

  if (text.length > 0) {
    text.push("");
  }
  if (isSet(snippet.description)) {
    var txt_descr =
      snippet.description instanceof Array
        ? snippet.description.join("\n ")
        : snippet.description;
    text.push("💡 " + txt_descr);
  }

  if (text.length > 0) {
    text.push("");
  }
  if (isSet(snippet.security)) {
    text.push("");
    var txt_security =
      snippet.security instanceof Array
        ? snippet.security.join("\n* ❗")
        : snippet.security;
    text.push("* ❗ " + txt_security);
  }

  if (text.length > 0) {
    text.push("");
  }

  if (isSet(snippet.instr_opcode))
    text.push(
      "🌎 [more...](https://www.evm.codes/#" +
        snippet.instr_opcode.toString(16).padStart(2, "0") +
        ")"
    );

  const contents = new vscode.MarkdownString(text.join("  \n"));
  contents.isTrusted = true;
  return new vscode.Hover(contents);

  function isSet(val) {
    return typeof val != "undefined" && val != "";
  }
}

function provideHoverHandler(document, position, token, type) {
  const range = document.getWordRangeAtPosition(position);
  
  if (!range || range.length <= 0) {
    return;
  }

  const word = document.getText(range);

  if (token.isCancellationRequested) {
    return token;
  }
  
  for (const snippet in asmArr) {
    if (asmArr[snippet].prefix == word || asmArr[snippet].hover == word) {      
        return createHover(snippet, asmArr[snippet], type);
    }
  }
}

module.exports = {
  provideHoverHandler: provideHoverHandler,
};