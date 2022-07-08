/**Update State
 * 
 * sugar for state setting
 * @param {vscode} vscode 
 * @param {any} state 
 */
export function updateState(vscode, state){
    vscode.setState({...vscode.getState(), ...state});
}
