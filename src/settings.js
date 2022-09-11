"use strict";
/**
 * @author @sw0nt github.com/Saw-mon-and-Natalie
 * @license MIT
 * @notes original: https://github.com/ConsenSys/vscode-solidity-auditor/blob/master/src/features/hover.js
 *
 * */
const vscode = require("vscode");

const LANGUAGE_ID = "huff";
const EXTENSION_NAME = "huff-language";

// Get current environment
const isWsl = vscode.env.remoteName === "wsl";
const wslMountedDriveRegex = /\/mnt\/(?<drive>.)/m;

function extensionConfig() {
  return vscode.workspace.getConfiguration(LANGUAGE_ID);
}

module.exports = {
  LANGUAGE_ID,
  EXTENSION_NAME,
  extensionConfig,
  isWsl,
  wslMountedDriveRegex,
};
