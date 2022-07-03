// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { 
        macroDefinitions: [],
        stackValues: {},
        showCalldata: false,
        calldataValue: "",
        runConstructorFirst: false
    };

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
    // Handle entering calldata
    function handleKeyPress(e){
        vscode.setState({...vscode.getState(), calldataValue: e.target.value});
    }
    calldataInput.addEventListener("keypress", handleKeyPress);
    calldataInput.addEventListener("change", handleKeyPress);


    function prepareDebugSession(){
        // Get the currently selected function selector
        const ul = document.querySelector(".stack-items");
        
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
        
        // Send a message to the main extension to trigger the hevm session
        vscode.postMessage({type: "start-macro-debug", values: {
            macro: macroDefinitions[selectedMacro],
            argsArr,
            stateChecked,
            calldataChecked,
            calldataValue
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