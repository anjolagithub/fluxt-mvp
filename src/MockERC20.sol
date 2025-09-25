// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing (following Cyfrin patterns)
 * @dev Used to simulate USDC/USDT in tests
 */
contract MockERC20 is ERC20 {
    uint8 private immutable i_decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        i_decimals = decimals_;
        _mint(msg.sender, initialSupply * 10 ** decimals_);
    }

    function decimals() public view override returns (uint8) {
        return i_decimals;
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     * @param to The address to mint to
     * @param amount The amount to mint (in token units)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from any address (for testing only)
     * @param from The address to burn from
     * @param amount The amount to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
