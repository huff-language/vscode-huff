// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { 
        macroDefinitions: [],
        stackValues: {},
        showCalldata: false,
        calldataValue: "",
        runConstructorFirst: false,
        showState: false,
        stateValues: {},
    };
    
    // TODO: validate that each of the storage slots are settable

    /** @type {Array<{ value: string }>} */
    let macroDefinitions = oldState.macroDefinitions || [];
    let selectedMacro = "";
    

    document.querySelector(".load-macro")
        .addEventListener("click", () => {
            vscode.postMessage({type: "loadMacros"});            
    });

    document.querySelector(".start-debug")
        .addEventListener("click", () => {
            prepareDebugSession();
    })

    const calldataInput = document.getElementById("calldata-input");
    const calldataChecked = document.getElementById("input[name=calldata-checkbox]:checked");
    const calldataCheckbox = document.getElementById("calldata-checkbox");
    
    if (oldState.showCalldata){
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
        
        vscode.setState({...vscode.getState() ,showCalldata: e.target.checked});
    })

    // Set calldatavalue to saved value
    calldataInput.value = oldState.calldataValue;

    // Is state overrides set
    const stateCheckbox = document.getElementById("storage-checkbox");
    const storageList = document.getElementById("storage-overrides");
    const addSlotButton = document.getElementById("add-slot");
    if (oldState.showState){
        stateCheckbox.checked = true;
        storageList.style.display = "block";
        addSlotButton.style.display = "block";
    } else {
        stateCheckbox.checked = false;
        storageList.style.display = "none";
        addSlotButton.style.display = "none";
    }

    stateCheckbox.addEventListener("click", (e) => {
        if (e.target.checked) {
            storageList.style.display = "block"  ;
            addSlotButton.style.display = "block";
        } else{
            storageList.style.display = "none"
            addSlotButton.style.display = "none";
        }

        vscode.setState({...vscode.getState() ,showState: e.target.checked});
    })

    // Set storage overrides to saved values
    Object.keys(oldState.stateValues).map(id => {
        const {key, value} = oldState.stateValues[id];
        renderStateSetter(id, key, value);
    })

    // Whenever the user clicks the add state button
    addSlotButton.addEventListener("click", (e) => {
        const id = Math.random().toString();

        renderStateSetter(id, false, false)
    });

    // Render a state setter widget
    function renderStateSetter(id, key, value){
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


    // Handle entering calldata
    function handleKeyPress(e){
        vscode.setState({...vscode.getState(), calldataValue: e.target.value});
    }
    calldataInput.addEventListener("keypress", handleKeyPress);
    calldataInput.addEventListener("change", handleKeyPress);


    function prepareDebugSession(){
        // Get the currently selected function selector
        const ul = document.querySelector(".stack-items");
        
        const state = vscode.getState();

        // Get the current arguments to execute with
        let argsArr = [];
        ul.childNodes.forEach(
            node => node.childNodes.forEach(
                input => argsArr.push(input.value)))

        // get state checkbox value
        const stateChecked = document.querySelector(".state-checkbox").checked;

        // Allow macro's to be spoofed with calldata
        const calldataChecked = document.querySelector(".calldata-checkbox").checked;
        const calldataValue = document.getElementById("calldata-input").value;

        // Get the state overrides if there are any
        const storageChecked = document.getElementById("storage-checkbox").checked;
        const stateValues = Object.keys(state.stateValues).map(id => state.stateValues[id]);  
        
        // Send a message to the main extension to trigger the hevm session
        vscode.postMessage({type: "start-macro-debug", values: {
            macro: macroDefinitions[selectedMacro],
            argsArr,
            stateChecked,
            calldataChecked,
            calldataValue,
            storageChecked,
            stateValues
        }})
    }


    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'receiveMacros': {
                addOptionsToMacroSelector(message.data);

                break;
            }
        }
    });


    /**Add Options to function selector
     * 
     * Each function selector defined within the interface will 
     * be a candidate for the debugger
     * 
     * @param {*} macroDefinitions 
     */
    function addOptionsToMacroSelector(_macroDefinitions){
        macroDefinitions = _macroDefinitions
        var functionSelectorDropdown = document.getElementById("macro-select");
        
        // listen for changes in the function that is selected
        functionSelectorDropdown.addEventListener("click", (event) => createStackInputs(event));

        // add each function as a drop down option
        for (const macro of Object.keys(_macroDefinitions)){
            var option = document.createElement("option");
            option.text = macro;
            functionSelectorDropdown.add(option); 
        }

        // select the first macro
        functionSelectorDropdown.click();
    }

    function createStackInputs(event){
        selectedMacro = event.target.value;
        const macroIfo = macroDefinitions[selectedMacro];

        const ul = document.querySelector(".stack-items");
        ul.textContent = "";
        for (let i=1; i <= macroIfo.takes; i++){
            const li = document.createElement("li");
            
            const input = document.createElement("input")
            input.className = "arg-input";
            input.value = i;
            input.type = "text";

            // allow for user input to the stack items
            input.addEventListener("change", (e)=> {
                
                input.value = e.target.value;
            })


            // Add input field to list item
            li.appendChild(input)

            // Add list item to the list
            ul.appendChild(li);
        }
    }

}());