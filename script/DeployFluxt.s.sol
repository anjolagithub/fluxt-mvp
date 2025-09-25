// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {FluxtWalletFactory} from "../src/FluxtWalletFactory.sol";
import {HelperConfig} from "./helpers/HelperConfig.s.sol";

/**
 * @title DeployFluxt
 * @notice Deployment script for FluxtWalletFactory following Cyfrin patterns
 * @dev Use with: forge script script/DeployFluxt.s.sol --rpc-url <RPC> --private-key <KEY> --broadcast
 */
contract DeployFluxt is Script {
    /*//////////////////////////////////////////////////////////////
                           DEPLOYMENT FUNCTION
    //////////////////////////////////////////////////////////////*/

    function run() external returns (FluxtWalletFactory fluxtWalletFactory, HelperConfig helperConfig) {
        // Get network configuration
        helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getActiveNetworkConfig();
        
        console.log("=== Deploying Fluxt Wallet Factory ===");
        helperConfig.printNetworkInfo();
        console.log("Deployer:", msg.sender);
        console.log("Deployer Balance:", msg.sender.balance / 1e18, "ETH");
        
        vm.startBroadcast();
        
        // Deploy FluxtWalletFactory
        fluxtWalletFactory = new FluxtWalletFactory(msg.sender);
        console.log("FluxtWalletFactory deployed at:", address(fluxtWalletFactory));
        
        // Add supported tokens
        (address[] memory tokens, string[] memory symbols) = helperConfig.getAllSupportedTokens();
        
        for (uint256 i = 0; i < tokens.length; i++) {
            fluxtWalletFactory.addSupportedToken(tokens[i], symbols[i]);
            console.log("Added", symbols[i], "token:", tokens[i]);
        }
        
        vm.stopBroadcast();
        
        // Deployment summary
        _printDeploymentSummary(fluxtWalletFactory, config);
        
        return (fluxtWalletFactory, helperConfig);
    }

    /*//////////////////////////////////////////////////////////////
                           UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function deployForTesting() external returns (FluxtWalletFactory fluxtWalletFactory, HelperConfig helperConfig) {
        return this.run();  // Fixed: use 'this.run()' instead of just 'run()'
    }

    function _printDeploymentSummary(
        FluxtWalletFactory fluxtWalletFactory,
        HelperConfig.NetworkConfig memory config
    ) internal view {
        console.log("\n=== Deployment Summary ===");
        console.log("Contract Address:", address(fluxtWalletFactory));
        console.log("Owner:", fluxtWalletFactory.owner());
        console.log("Total Users:", fluxtWalletFactory.getTotalUsers());
        
        // Check supported tokens
        if (config.usdcToken != address(0)) {
            console.log("USDC Supported:", fluxtWalletFactory.isTokenSupported(config.usdcToken));
        }
        if (config.usdtToken != address(0)) {
            console.log("USDT Supported:", fluxtWalletFactory.isTokenSupported(config.usdtToken));
        }
        
        console.log("Deployment Block:", block.number);
        
        // Verification command
        console.log("\n=== Verification Command ===");
        console.log("forge verify-contract", address(fluxtWalletFactory), "src/FluxtWalletFactory.sol:FluxtWalletFactory");
        console.log("--constructor-args $(cast abi-encode \"constructor(address)\" %s)", fluxtWalletFactory.owner());
        console.log("--chain", config.chainId);
        
        // Interaction examples
        console.log("\n=== Interaction Examples ===");
        console.log("# Create wallet for user:");
        console.log("cast send", address(fluxtWalletFactory), "\"createWallet(address)\" <USER_ADDRESS>");
        console.log("# Check wallet exists:");
        console.log("cast call", address(fluxtWalletFactory), "\"walletExists(address)\" <USER_ADDRESS>");
        console.log("# Get user balance:");
        console.log("cast call", address(fluxtWalletFactory), "\"getBalance(address,address)\" <USER_ADDRESS> <TOKEN_ADDRESS>");
    }
}
