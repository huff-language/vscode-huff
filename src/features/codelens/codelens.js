const vscode = require("vscode");
const { EXTENSION_NAME } = require("../../settings");
const {
  getMacroAsArray,
  getMacroByName,
  getMacroGroups,
  getImports,
  macroCallRegex,
} = require("../regexUtils");
const strip = require("strip-comments");
const { opcodes } = require("./opcodes");
const { flattenFile } = require("../debugger/function/debugger");

class CodeLensProvider {
  constructor() {
    this.codeLenses = [];
    this._onDidChangeCodeLenses = new vscode.EventEmitter();
    this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    // Trigger the code lens when the doc changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  provideCodeLenses(document, token) {
    if (
      vscode.workspace
        .getConfiguration("huff-language")
        .get("enableCodeLens", true)
    ) {
      this.codeLenses = [];
      const text = document.getText();
      let matches = getMacroAsArray(text);

      for (const match of matches) {
        // Get start of macro
        const line = document.lineAt(document.positionAt(match.index).line);
        const indexOf = line.text.indexOf("#");
        const startPosition = new vscode.Position(line.lineNumber, indexOf);

        // Get end of macro
        const endLine = document.lineAt(
          document.positionAt(match.indexEnd).line
        );
        const endIndexOf = endLine.text.indexOf("}");
        const endPosition = new vscode.Position(endLine.lineNumber, endIndexOf);

        // Provide range for code lens
        const range = new vscode.Range(startPosition, endPosition);
        if (range) {
          this.codeLenses.push(new vscode.CodeLens(range));
        }
      }
      return this.codeLenses;
    }
    return [];
  }

  resolveCodeLens(codeLens, token) {
    if (
      vscode.workspace
        .getConfiguration(EXTENSION_NAME)
        .get("enableCodeLens", true)
    ) {
      // Get all possible stack states for a macro
      const [stacks, annotatedStacks] = getPossibleStacks(codeLens);

      console.log(stacks);
      let lensText = "";

      // TODO: clean this up
      if (stacks.length > 1) {
        lensText += "Multiple stack states found: ";
        for (const stackCount of stacks) {
          lensText +=
            stackCount >= 0 ? `${stackCount.toString()} | ` : "Stack Underflow";
        }
      } else {
        lensText += "Stack state: ";
        lensText +=
          stacks[0] >= 0 ? `${stacks[0].toString()}` : "Stack Underflow";
      }

      codeLens.command = {
        title: lensText,
        tooltip: "Click to inspect the different stack paths",
        // TODO: generate stack report
        command: "huff.tools.stackInspector",
        arguments: [annotatedStacks],
      };
      return codeLens;
    }
    return null;
  }
}

function getPossibleStacks(codeLens) {
  // Collapse file
  const document = vscode.window.activeTextEditor?.document;
  // TODO: memoize - update it on saves - May be more efficient to only memoise the current files deps?
  const flattenedFile = getFlattenedFileWithImports();

  const wholeMacro = document.getText(codeLens.range);
  const macro = getMacroGroups(wholeMacro + "}");
  const strippedMacro = strip(macro.body)
    .replace(/[\s|\n]+/g, " ")
    .trim()
    .split(" ");

  // TODO: have a less hacky empty macro case
  if (strippedMacro.length === 1 && strippedMacro[0] === "") return [0];

  // TODO: Create a method to flatten the path tree
  const possiblePaths = calculateJumpPaths(strippedMacro);

  const stacks = [];
  const annotatedStacks = [];
  for (const path of possiblePaths) {
    const [stackHeight, annotated] = calcStack(
      flattenedFile,
      path,
      parseInt(macro.takes),
      parseInt(macro.returns)
    );
    stacks.push(stackHeight);
    annotatedStacks.push(annotated);
  }

  // Return both stacks and paths
  // Paths are forwarded to the code lens to be used for debugging
  return [stacks, annotatedStacks];
}

function getFlattenedFileWithImports() {
  const document = vscode.window.activeTextEditor?.document;
  const imports = getImports(document.getText());
  const workspace = vscode.workspace.getWorkspaceFolder(document.uri).uri.path;
  const currentFile = vscode.workspace.asRelativePath(document.uri);
  return flattenFile(workspace, currentFile, imports);
}

function calcStack(flattenedFile, macro, takes, returns) {
  stack = takes;

  // Keep an annotated stack alongside the running average to
  // enable expanded debugging
  const annotatedStack = [];
  for (const op of macro) {
    // TODO: check for builtins manually first

    switch (op.toString().charAt(0)) {
      case "[": {
        stack++;
        break;
      }
      case "0": {
        if (op.toString().charAt(1) == "x") stack++;
        break;
      }
      case "<": {
        // TODO: how to handle macros passed as args
        stack++;
        break;
      }
      default: {
        if (opcodes[op]) {
          // Catch under-flows
          stack -= opcodes[op].takes;
          if (stack < 0) return -1;

          stack += opcodes[op].returns;
        } else {
          // regex for a macro call
          const regex = new RegExp(macroCallRegex);
          const match = regex.exec(op);
          if (match) {
            // find the macro definition within the flattened document
            const [takes, returns] = getMacroByName(
              flattenedFile,
              match.groups.name
            );
            console.log(match.groups.name, takes, returns);

            stack -= +takes;

            // Catch under-flows
            if (stack < 0) return -1;

            stack += +returns;
          } else {
            // if it is a branch label increment, else a jumpdest, do nothing
            if (!op.endsWith(":")) stack++;
          }
        }
      }
    }

    // Store operation and depth
    annotatedStack.push({ op, stack });
  }

  return [stack, annotatedStack];
}

/** Calculate Jump Paths
 *
 * Recursively calculates jump paths for a given macro
 * This method detects cyclic jumps and will return an empty array if it finds one
 *
 * @param {Array<String>} macro An array of a macro's instructions
 * @param {String} cycleLabel Used to find cyclic jump labels
 * @returns
 */
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

      // TODO: More efficient jump method? - does this find paths that are nested?
      const jumpIndex = macro.findIndex((op) => op == dest);

      if (op == "jumpi") {
        // Recursively find both if an else paths
        const ifPath = calculateJumpPaths(macro.slice(jumpIndex), label);
        const elsePath = calculateJumpPaths(macro.slice(i + 1), label);

        // For each path in sub path add the current to the path
        // TODO: Accidentially removes the jumpi - Add it back in
        // TODO: Accidentially removes the jumpi - Add it back in
        // TODO: Accidentially removes the jumpi - Add it back in
        // TODO: Accidentially removes the jumpi - Add it back in
        for (const path of ifPath) {
          path.unshift(...preJump);
        }
        for (const path of elsePath) {
          path.unshift(...preJump);
        }

        return [...ifPath, ...elsePath];
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

  return [macro];
}

module.exports = {
  CodeLensProvider,
};
