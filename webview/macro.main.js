// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { macroDefinitions: [] };

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


    function prepareDebugSession(){
        // Get the currently selected function selector
        const ul = document.querySelector(".stack-items");
        
        // Get the current arguments to execute with
        let argsArr = [];
        ul.childNodes.forEach(
            node => node.childNodes.forEach(
                input => argsArr.push(input.value)))

        // get state checkbox value
        const checked = document.querySelector(".state-checkbox").checked;

        // Send a message to the main extension to trigger the hevm session
        vscode.postMessage({type: "start-macro-debug", values: {
            macro: macroDefinitions[selectedMacro],
            argsArr,
            stateChecked: checked
        }})
    }


    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'receiveMacros': {
                addOptionsToMacroSelector(message.data)
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
        functionSelectorDropdown.addEventListener("change", (event) => createStackInputs(event))

        // add each function as a drop down option
        for (const macro of Object.keys(_macroDefinitions)){
            var option = document.createElement("option");
            option.text = macro;
            functionSelectorDropdown.add(option); 
        }

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
                
                // TODO: some input validation                
                input.value = e.target.value;
            })


            // Add input field to list item
            li.appendChild(input)

            // Add list item to the list
            ul.appendChild(li);
        }
    } 

}());