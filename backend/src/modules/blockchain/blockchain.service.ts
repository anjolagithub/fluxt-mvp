import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet, ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/entities/user.entity';
import { Transaction } from '../../infra/entities/transaction.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  readonly provider: JsonRpcProvider;
  readonly wallet: Wallet;
  readonly contract: Contract;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {
    const rpcUrl = this.config.getOrThrow<string>('RPC_URL');
    const privateKey = this.config.getOrThrow<string>('PRIVATE_KEY');
    const contractAddress = this.config.getOrThrow<string>('CONTRACT_ADDRESS');
    const abiPath = path.join(process.cwd(), 'FluxtWalletFactory.abi.json');

    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey ?? '', this.provider);
    this.contract = new Contract(contractAddress ?? '', abi, this.wallet);
  }

  async onModuleInit(): Promise<void> {
    // Event listeners disabled due to RPC provider limitations
    // Events will be processed from transaction receipts instead
    this.logger.log('BlockchainService initialized');
  }

  /**
   * Gets or creates a wallet for a user
   * Returns the user address (deterministic from WhatsApp ID)
   */
  async getOrGenerateWalletAddress(userWhatsAppId: string): Promise<string> {
    try {
      // Check if user already exists in DB
      const existing = await this.usersRepo.findOne({
        where: { userWhatsAppId },
      });

      if (existing?.userAddress) {
        // User exists - return their address
        this.logger.log(`User exists for ${userWhatsAppId} (from DB)`);
        return existing.userAddress;
      }

      // New user - create wallet on-chain
      return await this.ensureWalletExistsOnChain(userWhatsAppId);
    } catch (error) {
      this.logger.error(
        `Error getting wallet for user ${userWhatsAppId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Ensures wallet exists on-chain (triggers actual wallet creation if needed)
   * ULTRA-FAST: Returns immediately without waiting for confirmation
   * Returns the USER ADDRESS (deterministic) - not the wallet contract
   */
  async ensureWalletExistsOnChain(userWhatsAppId: string): Promise<string> {
    try {
      // Generate deterministic user address (required by contract)
      const userAddress = this.generateDeterministicAddress(userWhatsAppId);

      this.logger.log(
        `🔥 Creating wallet on-chain for user ${userWhatsAppId}...`,
      );

      try {
        // Send transaction with fixed gas limit (skip estimation = faster!)
        const tx = await this.contract.createWallet(userAddress, {
          gasLimit: 150000,
        });
        this.logger.log(
          `📤 TX sent: ${tx.hash} - proceeding without confirmation`,
        );

        // Background: Monitor transaction
        this.monitorWalletCreation(tx.hash, userWhatsAppId, userAddress).catch(
          (err) => {
            this.logger.error(
              `Error monitoring wallet creation: ${err.message}`,
            );
          },
        );

        this.logger.log(`✅ Wallet creation initiated for: ${userAddress}`);

        return userAddress; // Return user address (what contract uses)
      } catch (error: any) {
        if (error.message?.includes('WalletAlreadyExists')) {
          this.logger.log(`Wallet already exists for ${userWhatsAppId}`);
          return userAddress;
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error creating wallet on-chain for user ${userWhatsAppId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Background monitoring of wallet creation (non-blocking)
   * Just logs the transaction result
   */
  private async monitorWalletCreation(
    txHash: string,
    userWhatsAppId: string,
    userAddress: string,
  ): Promise<void> {
    try {
      this.logger.log(`🔍 Monitoring TX ${txHash}...`);

      const receipt = await this.provider.waitForTransaction(txHash, 1);

      if (!receipt) {
        this.logger.error(`Transaction ${txHash} not found`);
        return;
      }

      // Check if transaction was successful
      if (receipt.status === 0) {
        this.logger.warn(
          `Transaction ${txHash} failed - wallet may already exist`,
        );
        return;
      }

      this.logger.log(
        `✅ Wallet confirmed for ${userWhatsAppId}: ${userAddress}`,
      );

      const actualCost = receipt.gasUsed * (receipt.gasPrice || 0n);
      this.logger.log(`💰 Gas used: ${ethers.formatEther(actualCost)} ETH`);
    } catch (error) {
      this.logger.error(`Error monitoring transaction ${txHash}:`, error);
    }
  }

  /**
   * Generates a deterministic Ethereum address from a WhatsApp user ID
   * This ensures the same WhatsApp ID always generates the same address
   * Required by the smart contract for user identification
   */
  private generateDeterministicAddress(userWhatsAppId: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(userWhatsAppId));
    const addressBytes = '0x' + hash.slice(26);
    return ethers.getAddress(addressBytes);
  }

  async getBalance(userOrWalletAddress: string, tokenAddress: string) {
    try {
      // Ensure addresses are properly checksummed
      const checksummedAddress = ethers.getAddress(userOrWalletAddress);
      const checksummedTokenAddress = ethers.getAddress(tokenAddress);

      // Try to use it as a user address first with the factory contract
      try {
        const walletExists =
          await this.contract.walletExists(checksummedAddress);

        if (walletExists) {
          // It's a user address - use factory's internal balance tracking
          return await this.contract.getBalance(
            checksummedAddress,
            checksummedTokenAddress,
          );
        }
      } catch (error) {
        // Not a user address, try as wallet contract address
      }

      // Fall back to checking ERC20 balance directly (for wallet contracts)
      const erc20Abi = [
        'function balanceOf(address account) view returns (uint256)',
      ];

      const tokenContract = new ethers.Contract(
        checksummedTokenAddress,
        erc20Abi,
        this.provider,
      );

      // Check balance of the wallet contract address directly
      const balance = await tokenContract.balanceOf(checksummedAddress);

      return balance;
    } catch (error) {
      this.logger.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Sends tokens between users using their user addresses
   */
  async sendToken(from: string, to: string, token: string, amount: bigint) {
    try {
      // from and to are USER ADDRESSES (deterministic from WhatsApp ID)
      const checksummedFrom = ethers.getAddress(from);
      const checksummedTo = ethers.getAddress(to);
      const checksummedToken = ethers.getAddress(token);

      this.logger.log(
        `💸 Sending ${ethers.formatUnits(amount, 6)} tokens from ${checksummedFrom} to ${checksummedTo}`,
      );

      // Get users by their user addresses
      const [fromUser, toUser] = await Promise.all([
        this.usersRepo.findOne({ where: { userAddress: checksummedFrom } }),
        this.usersRepo.findOne({ where: { userAddress: checksummedTo } }),
      ]);

      if (!fromUser || !toUser) {
        throw new Error('User not found for address');
      }

      // Use the factory's sendToken function with user addresses
      const tx = await this.contract.sendToken(
        checksummedFrom,
        checksummedTo,
        checksummedToken,
        amount,
      );

      const receipt = await tx.wait();

      this.logger.log(`✅ Transfer successful: ${receipt.hash}`);

      const txHash = receipt?.hash ?? receipt?.transactionHash;

      // Save transaction record
      await this.txRepo.save(
        this.txRepo.create({
          txHash,
          fromUser: fromUser,
          toUser: toUser,
          amount: ethers.formatUnits(amount, 6),
          currency:
            checksummedToken === this.config.get<string>('USDC_ADDRESS')
              ? 'USDC'
              : 'USDT',
          status: 'confirmed',
        }),
      );

      return receipt;
    } catch (error) {
      this.logger.error('Error sending token:', error);
      throw error;
    }
  }

  /**
   * Deposits tokens into a user's wallet (triggers wallet creation if needed)
   * This is called when external tokens are sent to a user
   */
  async depositToken(
    userWhatsAppId: string,
    tokenAddress: string,
    amount: bigint,
  ) {
    try {
      // Ensure wallet exists on-chain BEFORE depositing (costs gas if first time)
      const userAddress = await this.ensureWalletExistsOnChain(userWhatsAppId);

      const checksummedToken = ethers.getAddress(tokenAddress);

      this.logger.log(
        `Depositing ${ethers.formatUnits(amount, 6)} tokens to user ${userWhatsAppId}`,
      );

      const tx = await this.contract.depositToken(
        userAddress,
        checksummedToken,
        amount,
      );
      const receipt = await tx.wait();

      this.logger.log(`Deposit successful! TX: ${receipt.hash}`);

      return receipt;
    } catch (error) {
      this.logger.error(
        `Error depositing tokens for user ${userWhatsAppId}:`,
        error,
      );
      throw error;
    }
  }
}
