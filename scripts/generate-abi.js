const fs = require("fs");
const path = require("path");
// Regenerate frontend/abi.js from the compiled TaskBoard artifact.
// Run after `npx hardhat compile`.
const artifact = require("../artifacts/contracts/TaskBoard.sol/TaskBoard.json");
const out = "window.AGENTBOARD_ABI = " + JSON.stringify(artifact.abi, null, 2) + ";\n";
fs.writeFileSync(path.join(__dirname, "..", "frontend", "abi.js"), out);
console.log("frontend/abi.js written (" + artifact.abi.length + " ABI entries).");
