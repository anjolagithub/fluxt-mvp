// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FluxtWalletFactory} from "../../src/FluxtWalletFactory.sol";
import {MockERC20} from "../../src/MockERC20.sol";
import {DeployFluxt} from "../../script/DeployFluxt.s.sol";
import {HelperConfig} from "../../script/helpers/HelperConfig.s.sol";

/**
 * @title IntegrationTest
 * @notice Integration tests using deployment scripts
 */
contract IntegrationTest is Test {
    FluxtWalletFactory public fluxtWalletFactory;
    HelperConfig public helperConfig;
    MockERC20 public usdc;
    MockERC20 public usdt;
    
    address public deployer = makeAddr("deployer");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        // Deploy using the actual deployment script (without prank to avoid conflict)
        DeployFluxt deployment = new DeployFluxt();
        
        // Use deployer address for the deployment
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);
        (fluxtWalletFactory, helperConfig) = deployment.deployForTesting();
        vm.stopPrank();

        // Get network config to access tokens
        HelperConfig.NetworkConfig memory config = helperConfig.getActiveNetworkConfig();
        
        // For Anvil, the helper config deploys mocks
        usdc = MockERC20(config.usdcToken);
        usdt = MockERC20(config.usdtToken);

        // Fund test users
        vm.startPrank(deployer);
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        if (address(usdt) != address(0)) {
            usdt.mint(alice, 1000e6);
            usdt.mint(bob, 1000e6);
        }
        vm.stopPrank();
    }

    function testIntegrationDeploymentWorks() public view {
        assertEq(fluxtWalletFactory.owner(), deployer);
        assertTrue(fluxtWalletFactory.isTokenSupported(address(usdc)));
        assertEq(fluxtWalletFactory.getTotalUsers(), 0);
    }

    function testIntegrationFullFlow() public {
        // Create wallets
        fluxtWalletFactory.createWallet(alice);
        fluxtWalletFactory.createWallet(bob);
        
        // Alice deposits USDC
        vm.startPrank(alice);
        usdc.approve(address(fluxtWalletFactory), 500e6);
        fluxtWalletFactory.depositToken(alice, address(usdc), 500e6);
        vm.stopPrank();
        
        // Transfer between users
        fluxtWalletFactory.sendToken(alice, bob, address(usdc), 200e6);
        
        // Verify balances
        assertEq(fluxtWalletFactory.getBalance(alice, address(usdc)), 300e6);
        assertEq(fluxtWalletFactory.getBalance(bob, address(usdc)), 200e6);
    }
}
