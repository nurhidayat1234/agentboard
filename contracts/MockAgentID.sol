// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only mock of the SPACE ID Agent ID registry.
/// Real registry (BNB Chain): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
/// Never deploy this mock to mainnet.
contract MockAgentID {
    mapping(address => uint256) public balances;

    function setBalance(address account, uint256 amount) external {
        balances[account] = amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}
