const { outputContentToSideEditor } = require("../commands");

function renderAnnotatedStack(annotatedStacks) {
  /// The annotated stacks object is an array of annotated stacks, which includes the opcode
  /// opcode and the stack height AFTER execution of the given opcode
  /// If the opcodes that appear per stack are identical, then we can assume that they are part of
  /// the same branch of instructions.
  /// As soon as the operations change we can assume that this is due to a jump taking place

  console.log("annotatedStacks");
  console.log(annotatedStacks);

  let content = "";
  // get the longest stack number
  const longestStack = getLongestStack(annotatedStacks);

  const branch = "├─";

  // compare all of the stacks with the original

  for (let i = 0; i < longestStack; ++i) {
    let renderRow = branch;

    // longest stack
    for (const stack of annotatedStacks) {
      // If all of  the stacks are the same then we do not have a branch to render
      if (stack?.[i]) {
      }
    }
  }

  outputContentToSideEditor(content);
}

function getLongestStack(stacks) {
  let max = 0;
  for (const stack of stacks) {
    max = stack.length > max ? stack.length : max;
  }
  return max;
}

module.exports = {
  renderAnnotatedStack,
};
