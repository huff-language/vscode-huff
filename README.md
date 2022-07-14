# VSCode Huff

**NOTE: Requires path installations of [huffc](https://github.com/huff-language/huff-rs) and [hevm](https://github.com/dapphub/dapptools/tree/master/src/hevm) from [dapptools](https://github.com/dapphub/dapptools) before use.**

Features at a glances: 
- Advanced language support
- Syntax Highlighting
- Hover cards detailing gas usage
- Code Generation

#### Hevm Powered Debugging
Step through execution of your contracts from external calls, or even individual macros. Manipulate the stack inputs when your macro starts and even override storage slots. Star power your productivity.

Open up any .huff file and press `Load Interface` to prepare external functions, enter in your calldata parameters and hit debug to get started.  


#### Code Generation
**Switch table generation**  
Generate the MAIN macro switch table with jumps from just the interface definition. No more visiting keccak online or using `cast sig xxx` to copy function selectors into your code. Just write the interface and let us handle the rest.

Usage:
    `commandPallete -> Huff: Generate MAIN() Switch Table`

**Event signature generation**
Similarly to switch table generation above. Forget about calculating the keccak of you event topics yourself. 

Usage:
    `commandPallete -> Huff: Generate interface signature from interface`

#### Hover Cards
Hovering the cursor over an opcode will explain what operation it performs, the minimum amount of gas it uses, as well as a link to evm.codes to read more about it. 
