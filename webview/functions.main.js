// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { functionSelectors: [] };

    /** @type {Array<{ value: string }>} */
    let functionSelectors = oldState.functionSelectors || [];
    let selectedFunction = [];
    
    document.querySelector(".load-interface").addEventListener("click", () => {
        console.log("load interface clicked")
        vscode.postMessage({type: "loadDocument"});
        
        // onLoadInterfaceClicked()
    });

    document.querySelector(".start-debug").addEventListener("click", () => {
        prepareDebugSession();
    })


    function prepareDebugSession(){
        // Get the currently selected function selector
        const ul = document.querySelector(".args-inputs");
        
        // Get the current arguments to execute with
        let argsArr = [];
        ul.childNodes.forEach(
            (node,i) => node.childNodes.forEach(
                input => argsArr.push([selectedFunction[1].args[i], input.value])))

        // Send a message to the main extension to trigger the hevm session
        vscode.postMessage({type: "start-debug", values: {
            selectedFunction,
            argsArr
        }})
    }


    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'receiveContractInterface': {
                addOptionsToFunctionSelector(message.data)
                break;
            }
            case 'addColor':
                {
                    addColor();
                    break;
                }
            case 'clearColors':
                {
                    colors = [];
                    updateColorList(colors);
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
    function addOptionsToFunctionSelector(_functionSelectors){
        functionSelectors = _functionSelectors
        var functionSelectorDropdown = document.getElementById("function-select");
        
        // listen for changes in the function that is selected
        functionSelectorDropdown.addEventListener("click", (event) => createArgsInputs(event))

        // add each function as a drop down option
        for (const fn in _functionSelectors){
            var option = document.createElement("option");
            option.text = _functionSelectors[fn].fnSig;
            functionSelectorDropdown.add(option); 
        }

        functionSelectorDropdown.click();
    }

    function createArgsInputs(event){
        const entries = Object.entries(functionSelectors);
        const funcProperties = entries.filter(([key, value]) => value.fnSig === event.target.value)[0];

        // store the whole object
        selectedFunction = funcProperties

        const ul = document.querySelector(".args-inputs");
        ul.textContent = "";
        for (const arg of funcProperties[1].args){
            const li = document.createElement("li");
            
            const input = document.createElement("input")
            input.className = "arg-input";
            input.value = arg;
            input.type = "text";
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