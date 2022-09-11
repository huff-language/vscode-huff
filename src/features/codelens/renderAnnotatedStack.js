const {
  outputContentToSideEditor,
  outputMdToSideEditor,
} = require("../commands");
const { CliPrettify } = require("markdown-table-prettify");

function renderAnnotatedStack(annotatedStacks) {
  /// The annotated stacks object is an array of annotated stacks, which includes the opcode
  /// opcode and the stack height AFTER execution of the given opcode
  /// If the opcodes that appear per stack are identical, then we can assume that they are part of
  /// the same branch of instructions.
  /// As soon as the operations change we can assume that this is due to a jump taking place

  let content = "";
  // get the longest stack number

  let header = "|Opcode|StackDepth|Takes|Returns|\n";
  header += "|-----|-----|-----|-----|\n";

  // compare all of the stacks with the original

  for (let i = 0; i < annotatedStacks.length; ++i) {
    content += `Path ${i + 1}\n`;
    let branchContent = header;
    for (let j = 0; j < annotatedStacks[i].length; ++j) {
      const { op, stack, tks, rets } = annotatedStacks[i][j];
      branchContent += `|${op}|${stack}|${tks}|${rets}|\n`;
    }
    branchContent = CliPrettify.prettify(branchContent);
    branchContent += "\n";
    content += branchContent;
  }

  outputMdToSideEditor(content);
}

module.exports = {
  renderAnnotatedStack,
};
