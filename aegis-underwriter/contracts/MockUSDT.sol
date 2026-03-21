// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT
 * @notice Mock USD₮ token for testnet deployments
 * @dev Allows anyone to mint tokens for testing purposes
 */
contract MockUSDT is ERC20 {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USD Tether", "USDT") {
        // Mint initial supply to deployer
        _mint(msg.sender, 1_000_000 * 10**DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     * @param to Recipient address
     * @param amount Amount to mint (in smallest units)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Faucet function - get 1000 USDT for testing
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**DECIMALS);
    }
}
