// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FluxtWalletFactory
 * @author Fluxt Team (following Cyfrin best practices)
 * @notice A custodial wallet factory for handling USDC/USDT transfers
 * @dev This contract creates lightweight wallets and manages stablecoin transfers
 */
contract FluxtWalletFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               TYPES
    //////////////////////////////////////////////////////////////*/

    struct UserWallet {
        address walletAddress;
        bool exists;
        uint256 createdAt;
        mapping(address => uint256) tokenBalances; // token => balance
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    mapping(address => UserWallet) private s_userWallets;
    mapping(address => bool) private s_supportedTokens;
    address[] private s_allUsers;
    uint256 private s_walletCounter;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event WalletCreated(address indexed user, address indexed wallet, uint256 timestamp);
    event TokenSent(address indexed from, address indexed to, address indexed token, uint256 amount);
    event TokenReceived(address indexed from, address indexed to, address indexed token, uint256 amount);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error FluxtWalletFactory__WalletAlreadyExists();
    error FluxtWalletFactory__WalletDoesNotExist();
    error FluxtWalletFactory__InvalidAddress();
    error FluxtWalletFactory__InsufficientBalance();
    error FluxtWalletFactory__UnsupportedToken();
    error FluxtWalletFactory__InvalidAmount();
    error FluxtWalletFactory__SameAddress();
    error FluxtWalletFactory__TransferFailed();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier validAddress(address addr) {
        if (addr == address(0)) {
            revert FluxtWalletFactory__InvalidAddress();
        }
        _;
    }

    modifier hasWallet(address user) {
        if (!s_userWallets[user].exists) {
            revert FluxtWalletFactory__WalletDoesNotExist();
        }
        _;
    }

    modifier supportedToken(address token) {
        if (!s_supportedTokens[token]) {
            revert FluxtWalletFactory__UnsupportedToken();
        }
        _;
    }

    modifier validAmount(uint256 amount) {
        if (amount == 0) {
            revert FluxtWalletFactory__InvalidAmount();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address initialOwner) Ownable(initialOwner) {
        // Constructor body can be empty since we're calling parent constructor
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Creates a new custodial wallet for a user
     * @param user The address of the user
     * @return walletAddress The generated wallet address for the user
     */
    function createWallet(address user) 
        external 
        validAddress(user) 
        returns (address walletAddress) 
    {
        if (s_userWallets[user].exists) {
            revert FluxtWalletFactory__WalletAlreadyExists();
        }

        // Generate deterministic wallet address (Cyfrin pattern)
        s_walletCounter++;
        walletAddress = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(user, address(this), s_walletCounter, block.timestamp)
                    )
                )
            )
        );

        // Initialize user wallet
        UserWallet storage userWallet = s_userWallets[user];
        userWallet.walletAddress = walletAddress;
        userWallet.exists = true;
        userWallet.createdAt = block.timestamp;

        s_allUsers.push(user);

        emit WalletCreated(user, walletAddress, block.timestamp);
        return walletAddress;
    }

    /**
     * @notice Deposits tokens into a user's wallet
     * @param user The user to deposit tokens for
     * @param token The token contract address
     * @param amount The amount to deposit
     */
    function depositToken(address user, address token, uint256 amount)
        external
        nonReentrant
        validAddress(user)
        validAddress(token)
        hasWallet(user)
        supportedToken(token)
        validAmount(amount)
    {
        // Transfer tokens from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update user's balance
        s_userWallets[user].tokenBalances[token] += amount;

        emit TokenDeposited(user, token, amount);
        emit TokenReceived(msg.sender, user, token, amount);
    }

    /**
     * @notice Transfers tokens from one user to another
     * @param from The sender's address
     * @param to The recipient's address  
     * @param token The token contract address
     * @param amount The amount to transfer
     */
    function sendToken(address from, address to, address token, uint256 amount)
        external
        nonReentrant
        validAddress(from)
        validAddress(to)
        validAddress(token)
        hasWallet(from)
        hasWallet(to)
        supportedToken(token)
        validAmount(amount)
    {
        if (from == to) {
            revert FluxtWalletFactory__SameAddress();
        }

        // Check sender's balance
        if (s_userWallets[from].tokenBalances[token] < amount) {
            revert FluxtWalletFactory__InsufficientBalance();
        }

        // Update balances
        s_userWallets[from].tokenBalances[token] -= amount;
        s_userWallets[to].tokenBalances[token] += amount;

        emit TokenSent(from, to, token, amount);
        emit TokenReceived(from, to, token, amount);
    }

    /**
     * @notice Withdraws tokens from a user's wallet to external address
     * @param user The user withdrawing tokens
     * @param token The token contract address
     * @param amount The amount to withdraw
     * @param recipient The address to receive the tokens
     */
    function withdrawToken(address user, address token, uint256 amount, address recipient)
        external
        nonReentrant
        validAddress(user)
        validAddress(token)
        validAddress(recipient)
        hasWallet(user)
        supportedToken(token)
        validAmount(amount)
    {
        // Check user's balance
        if (s_userWallets[user].tokenBalances[token] < amount) {
            revert FluxtWalletFactory__InsufficientBalance();
        }

        // Update balance
        s_userWallets[user].tokenBalances[token] -= amount;
        
        // Transfer tokens from contract to recipient
        IERC20(token).safeTransfer(recipient, amount);

        emit TokenWithdrawn(user, token, amount);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Adds a supported token (owner only)
     * @param token The token contract address
     * @param symbol The token symbol for logging
     */
    function addSupportedToken(address token, string calldata symbol) 
        external 
        onlyOwner 
        validAddress(token) 
    {
        s_supportedTokens[token] = true;
        emit TokenAdded(token, symbol);
    }

    /**
     * @notice Removes a supported token (owner only)
     * @param token The token contract address
     */
    function removeSupportedToken(address token) 
        external 
        onlyOwner 
        validAddress(token) 
    {
        s_supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @notice Emergency withdrawal function (owner only)
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     * @param recipient The recipient address
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient)
        external
        onlyOwner
        validAddress(token)
        validAddress(recipient)
        validAmount(amount)
    {
        IERC20(token).safeTransfer(recipient, amount);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Gets a user's token balance
     * @param user The user address
     * @param token The token contract address
     * @return balance The user's token balance
     */
    function getBalance(address user, address token) 
        external 
        view 
        validAddress(user)
        validAddress(token)
        hasWallet(user)
        supportedToken(token)
        returns (uint256 balance) 
    {
        return s_userWallets[user].tokenBalances[token];
    }

    /**
     * @notice Gets a user's wallet address
     * @param user The user address
     * @return walletAddress The user's wallet address
     */
    function getUserWallet(address user) 
        external 
        view 
        validAddress(user)
        hasWallet(user)
        returns (address walletAddress) 
    {
        return s_userWallets[user].walletAddress;
    }

    /**
     * @notice Checks if a wallet exists for a user
     * @param user The user address
     * @return exists Whether the wallet exists
     */
    function walletExists(address user) external view returns (bool exists) {
        return s_userWallets[user].exists;
    }

    /**
     * @notice Checks if a token is supported
     * @param token The token address
     * @return supported Whether the token is supported
     */
    function isTokenSupported(address token) external view returns (bool supported) {
        return s_supportedTokens[token];
    }

    /**
     * @notice Gets the total number of users
     * @return count The total user count
     */
    function getTotalUsers() external view returns (uint256 count) {
        return s_allUsers.length;
    }

    /**
     * @notice Gets user address at specific index
     * @param index The index to query
     * @return user The user address at that index
     */
    function getUserAtIndex(uint256 index) external view returns (address user) {
        if (index >= s_allUsers.length) {
            revert FluxtWalletFactory__InvalidAddress();
        }
        return s_allUsers[index];
    }

    /**
     * @notice Gets user wallet creation timestamp
     * @param user The user address
     * @return timestamp When the wallet was created
     */
    function getWalletCreationTime(address user) 
        external 
        view 
        validAddress(user)
        hasWallet(user)
        returns (uint256 timestamp) 
    {
        return s_userWallets[user].createdAt;
    }
}
