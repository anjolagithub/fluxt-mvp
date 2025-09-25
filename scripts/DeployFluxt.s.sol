// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
                          NETWORK CONFIGURATIONS
    //////////////////////////////////////////////////////////////*/

    function getNetworkConfig() internal view returns (NetworkConfig memory) {
        if (block.chainid == 80001) {
            // Polygon Mumbai testnet
            return NetworkConfig({
                usdcToken: 0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e, // Mumbai USDC
                usdtToken: 0xBD21A10F619BE90d6066c941b04e4B3a3b8cb1AA,  // Mumbai USDT
                networkName: "Polygon Mumbai"
            });
        } else if (block.chainid == 84532) {
            // Base Sepolia testnet
            return NetworkConfig({
                usdcToken: 0x036CbD53842c5426634e7929541eC2318f3dCF7e, // Base Sepolia USDC
                usdtToken: address(0), // No official USDT on Base Sepolia yet
                networkName: "Base Sepolia"
            });
        } else if (block.chainid == 11155111) {
            // Ethereum Sepolia testnet
            return NetworkConfig({
                usdcToken: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, // Sepolia USDC
                usdtToken: address(0), // No official USDT on Sepolia
                networkName: "Ethereum Sepolia"
            });
        } else if (block.chainid == 31337) {
            // Anvil local network - no real tokens
            return NetworkConfig({
                usdcToken: address(0),
                usdtToken: address(0),
                networkName: "Anvil Local"
            });
        } else {
            // Unknown network
            console.log("Unknown network, chain ID:", block.chainid);
            return NetworkConfig({
                usdcToken: address(0),
                usdtToken: address(0),
                networkName: "Unknown"
            });
        }
    }

    /*//////////////////////////////////////////////////////////////
                           HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function deployToAnvil() external returns (FluxtWalletFactory fluxtWalletFactory) {
        console.log("=== Deploying to Anvil with Mock Tokens ===");
        
        vm.startBroadcast();
        
        // Deploy mock tokens for testing
        MockERC20 mockUsdc = new MockERC20("USD Coin", "USDC", 6, 1_000_000);
        MockERC20 mockUsdt = new MockERC20("Tether USD", "USDT", 6, 1_000_000);
        
        console.log("Mock USDC deployed at:", address(mockUsdc));
        console.log("Mock USDT deployed at:", address(mockUsdt));
        
        // Deploy FluxtWalletFactory
        fluxtWalletFactory = new FluxtWalletFactory(msg.sender);
        
        // Add mock tokens
        fluxtWalletFactory.addSupportedToken(address(mockUsdc), "USDC");
        fluxtWalletFactory.addSupportedToken(address(mockUsdt), "USDT");
        
        vm.stopBroadcast();
        
        console.log("FluxtWalletFactory deployed at:", address(fluxtWalletFactory));
        console.log("Ready for testing!");
        
        return fluxtWalletFactory;
    }
}

/**
 * @notice Mock ERC20 for local testing
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply * 10**_decimals;
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    /*//////////////////////////////////////////////////////////////
                           UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function deployForTesting() external returns (FluxtWalletFactory fluxtWalletFactory, HelperConfig helperConfig) {
        return run();
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
        console.log("Gas Price:", tx.gasprice);
        
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
