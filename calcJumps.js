// TODO: DELETE THIS FILE

// Alternative traversal method
function calculateJumpPaths(macro, cycleLabel) {
  for (let i = 0; i < macro.length; i++) {
    const op = macro[i];
    if (op == "jump" || op == "jumpi") {
      // Get jump label

      const label = macro[i - 1];

      // Detect an infinite loop cycle - Floyd's method
      if (label == cycleLabel) return [];

      const dest = `${label}:`;
      const preJump = macro.slice(0, i);
      const jumpIndex = macro.findIndex((op) => op == dest);

      if (op == "jumpi") {
        // Recursively find both if an else paths
        // TODO: bring back jumpis
        const ifPath = calculateJumpPaths(macro.slice(jumpIndex), label);
        const elsePath = calculateJumpPaths(macro.slice(i + 1), label);

        preJump.push([ifPath, elsePath]);

        return preJump;
      } else {
        // Recursively find jump following
        const subPaths = calculateJumpPaths(macro.slice(jumpIndex), label);
        for (const path of subPaths) {
          path.unshift(...preJump);
        }
        return subPaths;
      }
    }
  }

  return macro;
}

const macro = [
  "0x00",
  "0x1",
  "ADD()",
  "0x00",
  "<fail>",
  "USE_FROM_IMPORT()",
  "somewhere",
  "jumpi",
  "0x3",
  "0x44",
  "0x54",
  "somewhere:",
  "0x1",
  "0x2",
  "0x3",
  "somewhere2",
  "jumpi",
  "0x1",
  "0x2",
  "0x3",
  "somewhere2:",
  "0x1",
  "0x2",
  "0x3",
];

console.log(JSON.stringify(calculateJumpPaths(macro)));
