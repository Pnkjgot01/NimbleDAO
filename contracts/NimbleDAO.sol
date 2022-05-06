// contracts/NimbleDAO.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NimbleDAO is ERC20 {
    constructor(uint256 initialSupply) ERC20("NimbleDAO", "NDAO") {
        _mint(msg.sender, initialSupply);
    }
}