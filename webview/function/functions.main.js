// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
import { updateState } from "../helpers.js";

function cleanState(state) {
  if (!state) state = {};
  return {
    functionSelectors: state.functionSelectors || {},
    selectedFunction: state.selectedFunction || null,
    argsValues: state.argsValues || {},
    showValue: state.showValue || false,
    value: state.value || null,
  };
}

(function () {
  const vscode = acquireVsCodeApi();
  const oldState = cleanState(vscode.getState());

  // load in clean
  updateState(vscode, oldState);

  /** @type {Array<{ value: string }>} */
  let functionSelectors = oldState.functionSelectors;
  let selectedFunction = oldState.selectedFunction;

  // load in saved functionSelectors
  addOptionsToFunctionSelector(functionSelectors, selectedFunction);

  // load in saved argsValues

  // load in saved showValue
  // Call value set
  const callValueCheckbox = document.getElementById("call-value-checkbox");
  const callValueInput = document.getElementById("call-value-input");
  if (oldState.showValue) {
    callValueInput.style.display = "block";
    callValueCheckbox.checked = true;
  } else {
    callValueInput.style.display = "none";
    callValueCheckbox.checked = false;
  }
  callValueInput.value = oldState.value;

  callValueCheckbox.addEventListener("click", (e) => {
    e.target.checked
      ? (callValueInput.style.display = "block")
      : (callValueInput.style.display = "none");

    updateState(vscode, { showValue: e.target.checked });
  });

  // Register listeners
  callValueInput.addEventListener("keypress", handleCallValueKeyPress);
  callValueInput.addEventListener("change", handleCallValueKeyPress);

  document.querySelector(".load-interface").addEventListener("click", () => {
    console.log("load interface clicked");
    document.getElementById("function-select").innerHTML = "";
    vscode.postMessage({ type: "loadDocument" });
  });

  document.querySelector(".start-debug").addEventListener("click", () => {
    prepareDebugSession();
  });

  function prepareDebugSession() {
    // Get the currently selected function selector
    const ul = document.querySelector(".args-inputs");

    // Get the current arguments to execute with
    let argsArr = [];
    ul.childNodes.forEach((node, i) =>
      node.childNodes.forEach((input) =>
        argsArr.push([selectedFunction[1].args[i], input.value])
      )
    );

    // Pass call value if selected
    let callValueChecked = document.getElementById(
      "call-value-checkbox"
    ).checked;
    const callValue = document.getElementById("call-value-input").value;
    if (callValue.length === 0) callValueChecked = false;

    // Send a message to the main extension to trigger the hevm session
    vscode.postMessage({
      type: "start-debug",
      values: {
        selectedFunction,
        argsArr,
        callValueChecked,
        callValue,
      },
    });
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "receiveContractInterface": {
        addOptionsToFunctionSelector(message.data, null);
        break;
      }
    }
  });

  /**Add Options to function selector
   *
   * Each function selector defined within the interface will
   * be a candidate for the debugger
   *
   * @param {*} functionSelectors
   */
  function addOptionsToFunctionSelector(_functionSelectors, selectedFunction) {
    functionSelectors = _functionSelectors;
    updateState(vscode, { functionSelectors });

    var functionSelectorDropdown = document.getElementById("function-select");

    // listen for changes in the function that is selected
    functionSelectorDropdown.addEventListener("click", (event) =>
      createArgsInputs(event)
    );

    // add each function as a drop down option
    for (const fn in _functionSelectors) {
      var option = document.createElement("option");
      option.text = _functionSelectors[fn].fnSig;
      functionSelectorDropdown.add(option);
    }

    if (selectedFunction)
      functionSelectorDropdown.value = selectedFunction[1].fnSig;

    functionSelectorDropdown.click();
  }

  function createArgsInputs(event) {
    // empty clicks
    if (!event.target.value) return;

    const entries = Object.entries(functionSelectors);
    const funcProperties = entries.filter(
      ([key, value]) => value.fnSig === event.target.value
    )[0];

    // store the whole object
    selectedFunction = funcProperties;
    updateState(vscode, { selectedFunction });

    const ul = document.querySelector(".args-inputs");
    ul.textContent = "";

    let i = 0;
    for (const arg of funcProperties[1].args) {
      const li = document.createElement("li");

      const input = document.createElement("input");
      input.className = "arg-input";
      input.id = ++i;

      const state = vscode.getState();
      input.value =
        state.argsValues &&
        state.argsValues[selectedFunction[0]] &&
        state.argsValues[selectedFunction[0]][i]
          ? state.argsValues[selectedFunction[0]][i]
          : arg;

      input.type = "text";
      input.addEventListener("input", (e) => {
        const id = e.target.id;
        input.value = e.target.value;

        // update the state to reflect the new value
        const state = vscode.getState();
        state.argsValues[selectedFunction[0]] =
          state.argsValues[selectedFunction[0]] || {};
        state.argsValues[selectedFunction[0]][id] = e.target.value;
        vscode.setState(state);
      });

      // Add input field to list item
      li.appendChild(input);

      // Add list item to the list
      ul.appendChild(li);
    }
  }

  // --------------- helper functions --------------- //
  function handleCallValueKeyPress(e) {
    updateState(vscode, { value: e.target.value });
  }
})();
