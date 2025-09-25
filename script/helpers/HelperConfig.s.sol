// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../../src/MockERC20.sol";

/**
 * @title HelperConfig
 * @notice Configuration helper for different networks following Cyfrin patterns
 * @dev Manages network-specific configurations and mock deployments
 */
contract HelperConfig is Script {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error HelperConfig__InvalidChainId();

    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/

    struct NetworkConfig {
        address usdcToken;
        address usdtToken;
        string networkName;
        uint256 chainId;
        bool isTestnet;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 public constant ETH_MAINNET_CHAIN_ID = 1;
    uint256 public constant ETH_SEPOLIA_CHAIN_ID = 11155111;
    uint256 public constant POLYGON_MAINNET_CHAIN_ID = 137;
    uint256 public constant POLYGON_MUMBAI_CHAIN_ID = 80001;
    uint256 public constant BASE_MAINNET_CHAIN_ID = 8453;
    uint256 public constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint256 public constant ANVIL_CHAIN_ID = 31337;

    NetworkConfig public activeNetworkConfig;

    // Keep track of deployed mocks to avoid redeployment
    mapping(uint256 => NetworkConfig) public networkConfigs;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        networkConfigs[ETH_SEPOLIA_CHAIN_ID] = getEthSepoliaConfig();
        networkConfigs[POLYGON_MUMBAI_CHAIN_ID] = getPolygonMumbaiConfig();
        networkConfigs[BASE_SEPOLIA_CHAIN_ID] = getBaseSepoliaConfig();

        if (block.chainid == ANVIL_CHAIN_ID) {
            activeNetworkConfig = getOrCreateAnvilConfig();
        } else {
            activeNetworkConfig = networkConfigs[block.chainid];
        }
        
        if (activeNetworkConfig.chainId == 0 && block.chainid != ANVIL_CHAIN_ID) {
            revert HelperConfig__InvalidChainId();
        }
    }

    /*//////////////////////////////////////////////////////////////
                          NETWORK CONFIGURATIONS
    //////////////////////////////////////////////////////////////*/

    function getEthSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            usdcToken: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, // Sepolia USDC
            usdtToken: address(0), // No official USDT on Sepolia
            networkName: "sepolia",
            chainId: ETH_SEPOLIA_CHAIN_ID,
            isTestnet: true
        });
    }

    function getPolygonMumbaiConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            usdcToken: 0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e, // Mumbai USDC
            usdtToken: 0xbd21A10f619BE90d6066c941B04E4B3A3b8cB1AA,  // Mumbai USDT (fixed checksum)
            networkName: "mumbai",
            chainId: POLYGON_MUMBAI_CHAIN_ID,
            isTestnet: true
        });
    }

    function getBaseSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            usdcToken: 0x036CbD53842c5426634e7929541eC2318f3dCF7e, // Base Sepolia USDC
            usdtToken: address(0), // No official USDT on Base Sepolia yet
            networkName: "base-sepolia",
            chainId: BASE_SEPOLIA_CHAIN_ID,
            isTestnet: true
        });
    }

    function getOrCreateAnvilConfig() public returns (NetworkConfig memory anvilConfig) {
        // Check if we already have anvil config with deployed tokens
        if (networkConfigs[ANVIL_CHAIN_ID].usdcToken != address(0)) {
            return networkConfigs[ANVIL_CHAIN_ID];
        }

        console.log("Deploying mock tokens for Anvil...");
        
        vm.startBroadcast();
        
        // Deploy mock tokens with realistic parameters
        MockERC20 mockUsdc = new MockERC20("USD Coin", "USDC", 6, 1_000_000_000); // 1B USDC
        MockERC20 mockUsdt = new MockERC20("Tether USD", "USDT", 6, 1_000_000_000); // 1B USDT
        
        vm.stopBroadcast();

        console.log("Mock USDC deployed at:", address(mockUsdc));
        console.log("Mock USDT deployed at:", address(mockUsdt));

        anvilConfig = NetworkConfig({
            usdcToken: address(mockUsdc),
            usdtToken: address(mockUsdt),
            networkName: "anvil",
            chainId: ANVIL_CHAIN_ID,
            isTestnet: true
        });

        // Store the config
        networkConfigs[ANVIL_CHAIN_ID] = anvilConfig;
        
        return anvilConfig;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getConfigByChainId(uint256 chainId) public view returns (NetworkConfig memory) {
        return networkConfigs[chainId];
    }

    function getActiveNetworkConfig() public view returns (NetworkConfig memory) {
        return activeNetworkConfig;
    }

    function isTestnet() public view returns (bool) {
        return activeNetworkConfig.isTestnet;
    }

    function getNetworkName() public view returns (string memory) {
        return activeNetworkConfig.networkName;
    }

    function getUsdcToken() public view returns (address) {
        return activeNetworkConfig.usdcToken;
    }

    function getUsdtToken() public view returns (address) {
        return activeNetworkConfig.usdtToken;
    }

    /*//////////////////////////////////////////////////////////////
                           UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getAllSupportedTokens() public view returns (address[] memory tokens, string[] memory symbols) {
        uint256 tokenCount = 0;
        
        // Count non-zero tokens
        if (activeNetworkConfig.usdcToken != address(0)) tokenCount++;
        if (activeNetworkConfig.usdtToken != address(0)) tokenCount++;
        
        tokens = new address[](tokenCount);
        symbols = new string[](tokenCount);
        
        uint256 index = 0;
        if (activeNetworkConfig.usdcToken != address(0)) {
            tokens[index] = activeNetworkConfig.usdcToken;
            symbols[index] = "USDC";
            index++;
        }
        
        if (activeNetworkConfig.usdtToken != address(0)) {
            tokens[index] = activeNetworkConfig.usdtToken;
            symbols[index] = "USDT";
        }
        
        return (tokens, symbols);
    }

    function printNetworkInfo() public view {
        console.log("=== Network Configuration ===");
        console.log("Chain ID:", activeNetworkConfig.chainId);
        console.log("Network Name:", activeNetworkConfig.networkName);
        console.log("Is Testnet:", activeNetworkConfig.isTestnet);
        console.log("USDC Token:", activeNetworkConfig.usdcToken);
        console.log("USDT Token:", activeNetworkConfig.usdtToken);
        console.log("==============================");
    }
}
