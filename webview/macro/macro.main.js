// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
import { updateState } from "../helpers.js";

// defaults for each state variable
function cleanState(state) {
    if (!state) state = {}
    return {
        selectedMacro: state.selectedMacro || "",
        macroDefinitions: state.macroDefinitions || {},
        stackValues: state.stackValues || {},
        showCalldata: state.showCalldata || false,
        calldataValue: state.calldataValue || "",
        runConstructorFirst: state.runConstructorFirst || false,
        showState: state.showState || false,
        stateValues: state.stateValues || {},
        currentFile: state.currentFile || ""
    };
}

(function () {

    // --------------- Initialization --------------- //
    const vscode = acquireVsCodeApi();
    const oldState = cleanState(vscode.getState());
    updateState(vscode, oldState);


    /** @type {Array<{ value: string }>} */
    let macroDefinitions = oldState.macroDefinitions;
    let selectedMacro = oldState.selectedMacro;


    // ----------------- Load previous state ----------------- //
    // load previously stored macros
    addOptionsToMacroSelector(macroDefinitions, selectedMacro);

    const calldataInput = document.getElementById("calldata-input");
    const calldataCheckbox = document.getElementById("calldata-checkbox");

    if (oldState.showCalldata) {
        calldataInput.style.display = "block"
        calldataCheckbox.checked = true;
    } else {
        calldataInput.style.display = "none"
        calldataCheckbox.checked = false;
    }

    calldataCheckbox.addEventListener("click", (e) => {
        e.target.checked
            ? calldataInput.style.display = "block"
            : calldataInput.style.display = "none"

        updateState(vscode, { showCalldata: e.target.checked });
    })

    // Set calldatavalue to saved value
    calldataInput.value = oldState.calldataValue;

    // Is state overrides set
    const stateCheckbox = document.getElementById("storage-checkbox");
    const storageList = document.getElementById("storage-overrides");
    const addSlotButton = document.getElementById("add-slot");
    if (oldState.showState) {
        stateCheckbox.checked = true;
        storageList.style.display = "block";
        addSlotButton.style.display = "block";
    } else {
        stateCheckbox.checked = false;
        storageList.style.display = "none";
        addSlotButton.style.display = "none";
    }

    // Set storage overrides to saved values
    Object.keys(oldState.stateValues).map(id => {
        const { key, value } = oldState.stateValues[id];
        renderStateSetter(id, key, value);
    })

    // ----------------- Event Handlers ----------------- //
    document.querySelector(".load-macro")
        .addEventListener("click", () => {
            // clear the current macro button
            document.getElementById("macro-select").innerHTML = "";
            vscode.postMessage({ type: "loadMacros" });
        });

    document.querySelector(".start-debug")
        .addEventListener("click", () => {
            prepareDebugSession();
        })

    stateCheckbox.addEventListener("click", (e) => {
        if (e.target.checked) {
            storageList.style.display = "block";
            addSlotButton.style.display = "block";
        } else {
            storageList.style.display = "none"
            addSlotButton.style.display = "none";
        }

        updateState(vscode, { showState: e.target.checked });
    })

    // Whenever the user clicks the add state button
    addSlotButton.addEventListener("click", (e) => {
        const id = Math.random().toString();

        renderStateSetter(id, false, false)
    });

    calldataInput.addEventListener("keypress", handleKeyPress);
    calldataInput.addEventListener("change", handleKeyPress);


    // ----------------- Message Handlers ----------------- //
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'receiveMacros': {
                // Add options to the macro selector
                addOptionsToMacroSelector(message.data, null);

                // save the currently edited file
                updateState(vscode, { currentFile: message.currentFile });
                break;
            }
            case 'updateMacros': {
                updateMacros(message.data);
                break;
            }
        }
    });


    // ----------------- Rendering ----------------- //
    // Render a state setter widget
    function renderStateSetter(id, key, value) {
        const newSlot = document.createElement("div");
        newSlot.id = id;

        newSlot.className = "storage-slot";
        newSlot.innerHTML = `
            <input type="text" class="storage-key-input" placeholder="Slot Key" ${key && 'value=' + key}>
            <input type="text" class="storage-value-input" placeholder="Value" ${value && 'value=' + value}>
            <button class="remove-slot">Remove</button>
            </br></br>
        `;

        // Ability to delete slot
        newSlot.querySelector(".remove-slot").addEventListener("click", (e) => {
            // remove the slot from the list by the id of the parent
            const slotToRemove = document.getElementById(e.target.parentElement.id);
            slotToRemove.remove();

            // remove the slot from the state
            const state = vscode.getState();
            delete state.stateValues[e.target.parentElement.id];
            vscode.setState(state);
        });

        // add listeners for input
        newSlot.querySelector(".storage-key-input").addEventListener("input", (e) => {
            // make setting state better
            const state = vscode.getState();
            state.stateValues[id] = {
                key: e.target.value,
                value: newSlot.querySelector(".storage-value-input").value,
            }
            vscode.setState(state);
        });
        newSlot.querySelector(".storage-value-input").addEventListener("input", (e) => {
            // make setting state better
            const state = vscode.getState();
            state.stateValues[id] = {
                key: newSlot.querySelector(".storage-key-input").value,
                value: e.target.value
            }
            vscode.setState(state);
        });


        storageList.appendChild(newSlot);

    }

    function prepareDebugSession() {
        // Get the currently selected function selector
        const ul = document.querySelector(".stack-items");
        const state = vscode.getState();

        // Get the current arguments to execute with
        let argsArr = [];
        ul.childNodes.forEach(
            node => node.childNodes.forEach(
                input => argsArr.push(input.value)))

        // TODO: reintroduce button - set as false for the meantime
        const stateChecked = false;

        // Allow macro's to be spoofed with calldata
        const calldataChecked = document.querySelector(".calldata-checkbox").checked;
        const calldataValue = document.getElementById("calldata-input").value;

        // Get the state overrides if there are any
        const storageChecked = document.getElementById("storage-checkbox").checked;
        const stateValues = state.stateValues ? Object.keys(state.stateValues).map(id => state.stateValues[id]) : [];

        // Send a message to the main extension to trigger the hevm session
        vscode.postMessage({
            type: "start-macro-debug", values: {
                macro: selectedMacro,
                argsArr,
                stateChecked,
                calldataChecked,
                calldataValue,
                storageChecked,
                stateValues
            }
        })
    }




    /**Add Options to function selector
     * 
     * Each function selector defined within the interface will 
     * be a candidate for the debugger
     * 
     * @param {*} macroDefinitions 
     * @param {String} selectedMacro
     */
    function addOptionsToMacroSelector(_macroDefinitions, selectedMacro) {
        // TODO: make function for this
        updateState(vscode, { macroDefinitions: _macroDefinitions });
        macroDefinitions = _macroDefinitions
        var functionSelectorDropdown = document.getElementById("macro-select");

        // listen for changes in the function that is selected
        functionSelectorDropdown.addEventListener("click", (event) => createStackInputs(event));

        // add each function as a drop down option
        for (const macro of Object.keys(_macroDefinitions)) {
            var option = document.createElement("option");
            option.text = macro;
            functionSelectorDropdown.add(option);
        }

        if (selectedMacro) functionSelectorDropdown.value = selectedMacro;

        // select the first macro
        functionSelectorDropdown.click();
    }

    /**Update Macro Conditions
     * 
     * Update the saved macro conditions so that they track across vscode saves
     * @param {Object} _macroDefinitions 
     */
    function updateMacros(_macroDefinitions) {
        macroDefinitions = _macroDefinitions;
        updateState(vscode, { macroDefinitions: _macroDefinitions });
    }

    /**Create stack inputs
     * 
     * Render stack inputs based on selected macro
     * @param event 
     */
    function createStackInputs(event) {
        selectedMacro = event.target.value;

        // TODO: make function for this
        updateState(vscode, { selectedMacro: selectedMacro });

        const macroIfo = macroDefinitions[selectedMacro];
        if (!macroIfo) return; // return if initializing a new file

        const ul = document.querySelector(".stack-items");
        ul.textContent = "";
        for (let i = 1; i <= macroIfo.takes; i++) {
            const li = document.createElement("li");

            const input = document.createElement("input")
            input.className = "arg-input";
            input.type = "text";
            input.id = i;

            // give saved value or default
            const state = vscode.getState();
            input.value = (
                state.stackValues[selectedMacro]
                && state.stackValues[selectedMacro][i]
            ) ?
                state.stackValues[selectedMacro][i]
                : i;


            // allow for user input to the stack items
            input.addEventListener("input", (e) => {
                const id = e.target.id;
                input.value = e.target.value;

                // Update the state to reflect the change
                const state = vscode.getState();
                state.stackValues[selectedMacro] = state.stackValues[selectedMacro] || {};
                state.stackValues[selectedMacro][id] = e.target.value;
                vscode.setState(state);
            })


            // Add input field to list item
            li.appendChild(input)

            // Add list item to the list
            ul.appendChild(li);
        }
    }


    // --------------- helper functions --------------- //
    // Handle entering calldata
    function handleKeyPress(e) {
        updateState(vscode, { calldataValue: e.target.value });
    }

}());