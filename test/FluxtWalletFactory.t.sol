// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FluxtWalletFactory} from "../src/FluxtWalletFactory.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FluxtWalletFactoryTest
 * @notice Basic test suite for FluxtWalletFactory
 * @dev Cyfrin-style testing without integration dependencies
 */
contract FluxtWalletFactoryTest is Test {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    FluxtWalletFactory public fluxtWalletFactory;
    MockERC20 public usdc;
    MockERC20 public usdt;

    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    uint256 public constant INITIAL_SUPPLY = 1_000_000; // 1M tokens
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant USDT_DECIMALS = 6;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event WalletCreated(address indexed user, address indexed wallet, uint256 timestamp);
    event TokenSent(address indexed from, address indexed to, address indexed token, uint256 amount);
    event TokenReceived(address indexed from, address indexed to, address indexed token, uint256 amount);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event TokenAdded(address indexed token, string symbol);

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock tokens (following Cyfrin patterns)
        usdc = new MockERC20("USD Coin", "USDC", uint8(USDC_DECIMALS), INITIAL_SUPPLY);
        usdt = new MockERC20("Tether USD", "USDT", uint8(USDT_DECIMALS), INITIAL_SUPPLY);

        // Deploy FluxtWalletFactory
        fluxtWalletFactory = new FluxtWalletFactory(owner);

        // Add supported tokens
        fluxtWalletFactory.addSupportedToken(address(usdc), "USDC");
        fluxtWalletFactory.addSupportedToken(address(usdt), "USDT");

        vm.stopPrank();

        // Fund test users with tokens using deal cheatcode
        deal(address(usdc), user1, 10_000 * 10**USDC_DECIMALS);
        deal(address(usdc), user2, 10_000 * 10**USDC_DECIMALS);
        deal(address(usdt), user1, 10_000 * 10**USDT_DECIMALS);
        deal(address(usdt), user2, 10_000 * 10**USDT_DECIMALS);
    }

    /*//////////////////////////////////////////////////////////////
                           DEPLOYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function testDeployment() public {
        assertEq(fluxtWalletFactory.owner(), owner);
        assertTrue(fluxtWalletFactory.isTokenSupported(address(usdc)));
        assertTrue(fluxtWalletFactory.isTokenSupported(address(usdt)));
        assertEq(fluxtWalletFactory.getTotalUsers(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                         WALLET CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testCreateWallet() public {
        // Test wallet creation without checking exact wallet address
        vm.expectEmit(true, false, false, true); // Only check user and timestamp, not wallet address
        emit WalletCreated(user1, address(0), block.timestamp); // address(0) as placeholder

        address walletAddr = fluxtWalletFactory.createWallet(user1);

        // Verify wallet creation
        assertTrue(fluxtWalletFactory.walletExists(user1));
        assertEq(fluxtWalletFactory.getUserWallet(user1), walletAddr);
        assertEq(fluxtWalletFactory.getTotalUsers(), 1);
        assertEq(fluxtWalletFactory.getUserAtIndex(0), user1);
        
        // Wallet address should not be zero
        assertTrue(walletAddr != address(0));
    }

    function testCreateMultipleWallets() public {
        address wallet1 = fluxtWalletFactory.createWallet(user1);
        address wallet2 = fluxtWalletFactory.createWallet(user2);

        // Wallets should be unique
        assertTrue(wallet1 != wallet2);
        assertEq(fluxtWalletFactory.getTotalUsers(), 2);
        assertEq(fluxtWalletFactory.getUserAtIndex(0), user1);
        assertEq(fluxtWalletFactory.getUserAtIndex(1), user2);
    }

    function testCreateWalletRevertsForExistingUser() public {
        fluxtWalletFactory.createWallet(user1);
        
        vm.expectRevert(FluxtWalletFactory.FluxtWalletFactory__WalletAlreadyExists.selector);
        fluxtWalletFactory.createWallet(user1);
    }

    function testCreateWalletRevertsForZeroAddress() public {
        vm.expectRevert(FluxtWalletFactory.FluxtWalletFactory__InvalidAddress.selector);
        fluxtWalletFactory.createWallet(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                         TOKEN DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function testDepositToken() public {
        // Setup
        fluxtWalletFactory.createWallet(user1);
        uint256 depositAmount = 1000 * 10**USDC_DECIMALS;

        // User approves contract
        vm.startPrank(user1);
        usdc.approve(address(fluxtWalletFactory), depositAmount);

        // Expect events
        vm.expectEmit(true, true, false, true);
        emit TokenDeposited(user1, address(usdc), depositAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TokenReceived(user1, user1, address(usdc), depositAmount);

        // Deposit tokens
        fluxtWalletFactory.depositToken(user1, address(usdc), depositAmount);
        vm.stopPrank();

        // Verify balance
        assertEq(fluxtWalletFactory.getBalance(user1, address(usdc)), depositAmount);
        assertEq(usdc.balanceOf(address(fluxtWalletFactory)), depositAmount);
    }

    /*//////////////////////////////////////////////////////////////
                         TOKEN TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function testSendToken() public {
        // Setup - create wallets and deposit tokens
        fluxtWalletFactory.createWallet(user1);
        fluxtWalletFactory.createWallet(user2);
        
        uint256 depositAmount = 1000 * 10**USDC_DECIMALS;
        uint256 transferAmount = 300 * 10**USDC_DECIMALS;

        vm.startPrank(user1);
        usdc.approve(address(fluxtWalletFactory), depositAmount);
        fluxtWalletFactory.depositToken(user1, address(usdc), depositAmount);
        vm.stopPrank();

        // Initial balances
        uint256 user1InitialBalance = fluxtWalletFactory.getBalance(user1, address(usdc));
        uint256 user2InitialBalance = fluxtWalletFactory.getBalance(user2, address(usdc));

        // Expect events
        vm.expectEmit(true, true, true, true);
        emit TokenSent(user1, user2, address(usdc), transferAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TokenReceived(user1, user2, address(usdc), transferAmount);

        // Transfer tokens
        fluxtWalletFactory.sendToken(user1, user2, address(usdc), transferAmount);

        // Verify balances
        assertEq(
            fluxtWalletFactory.getBalance(user1, address(usdc)),
            user1InitialBalance - transferAmount
        );
        assertEq(
            fluxtWalletFactory.getBalance(user2, address(usdc)),
            user2InitialBalance + transferAmount
        );
    }

    function testSendTokenRevertsInsufficientBalance() public {
        fluxtWalletFactory.createWallet(user1);
        fluxtWalletFactory.createWallet(user2);
        
        uint256 transferAmount = 1000 * 10**USDC_DECIMALS; // More than balance (0)

        vm.expectRevert(FluxtWalletFactory.FluxtWalletFactory__InsufficientBalance.selector);
        fluxtWalletFactory.sendToken(user1, user2, address(usdc), transferAmount);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function testAddSupportedToken() public {
        MockERC20 newToken = new MockERC20("NEW", "NEW", 18, 1000);
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit TokenAdded(address(newToken), "NEW");
        
        fluxtWalletFactory.addSupportedToken(address(newToken), "NEW");
        
        assertTrue(fluxtWalletFactory.isTokenSupported(address(newToken)));
    }

    function testAddSupportedTokenRevertsNonOwner() public {
        MockERC20 newToken = new MockERC20("NEW", "NEW", 18, 1000);
        
        vm.prank(user1);
        // OpenZeppelin v5 uses custom error instead of string
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        fluxtWalletFactory.addSupportedToken(address(newToken), "NEW");
    }

    /*//////////////////////////////////////////////////////////////
                           INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testFullWorkflow() public {
        console.log("=== Testing Full Fluxt Workflow ===");
        
        // 1. Create wallets for two users
        console.log("1. Creating wallets...");
        address wallet1 = fluxtWalletFactory.createWallet(user1);
        address wallet2 = fluxtWalletFactory.createWallet(user2);
        
        console.log("User1 wallet:", wallet1);
        console.log("User2 wallet:", wallet2);
        
        // 2. User1 deposits USDC
        console.log("2. User1 depositing 1000 USDC...");
        uint256 depositAmount = 1000 * 10**USDC_DECIMALS;
        
        vm.startPrank(user1);
        usdc.approve(address(fluxtWalletFactory), depositAmount);
        fluxtWalletFactory.depositToken(user1, address(usdc), depositAmount);
        vm.stopPrank();
        
        console.log("User1 USDC balance:", fluxtWalletFactory.getBalance(user1, address(usdc)));
        
        // 3. User1 sends USDC to User2
        console.log("3. User1 sending 300 USDC to User2...");
        uint256 transferAmount = 300 * 10**USDC_DECIMALS;
        
        fluxtWalletFactory.sendToken(user1, user2, address(usdc), transferAmount);
        
        console.log("After transfer:");
        console.log("User1 USDC balance:", fluxtWalletFactory.getBalance(user1, address(usdc)));
        console.log("User2 USDC balance:", fluxtWalletFactory.getBalance(user2, address(usdc)));
        
        // Final assertions
        assertEq(fluxtWalletFactory.getBalance(user1, address(usdc)), 700 * 10**USDC_DECIMALS);
        assertEq(fluxtWalletFactory.getBalance(user2, address(usdc)), 300 * 10**USDC_DECIMALS);
        assertEq(fluxtWalletFactory.getTotalUsers(), 2);
        
        console.log("=== Full workflow test passed! ===");
    }
}
