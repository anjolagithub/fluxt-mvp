import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ethers } from 'ethers';
import { User } from '../../infra/entities/user.entity';
import { DepositService } from './deposit.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DepositMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DepositMonitorService.name);
  private usdcContract: Contract;
  private isMonitoring = false;
  private depositAddresses: Map<string, User> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastCheckedBlock: number = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly deposit: DepositService,
    private readonly blockchain: BlockchainService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    const usdcAddress = this.config.getOrThrow<string>('USDC_ADDRESS');
    const usdcAbi = [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'function balanceOf(address) view returns (uint256)',
    ];

    this.usdcContract = new ethers.Contract(
      usdcAddress,
      usdcAbi,
      this.blockchain.provider,
    );
  }

  async onModuleInit() {
    // Auto-start monitoring if enabled in config
    const autoStart = this.config.get<string>(
      'AUTO_START_DEPOSIT_MONITOR',
      'false',
    );

    if (autoStart === 'true') {
      this.logger.log('🔍 Auto-starting deposit monitoring...');
      // Don't await - start in background to avoid blocking server startup
      this.startMonitoring().catch((err) => {
        this.logger.error('Failed to start deposit monitoring:', err);
      });
    } else {
      this.logger.log(
        'ℹ️  Deposit monitoring disabled. Set AUTO_START_DEPOSIT_MONITOR=true to enable',
      );
    }
  }

  /**
   * Starts monitoring all deposit addresses for USDC transfers
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Deposit monitoring already running');
      return;
    }

    this.logger.log('🚀 Starting deposit monitoring...');

    // Load initial deposit addresses
    await this.refreshDepositAddresses();

    if (this.depositAddresses.size === 0) {
      this.logger.warn(
        '⚠️  No deposit addresses found. Skipping monitoring setup.',
      );
      this.logger.log(
        '💡 Create wallets first, then start monitoring when users have deposit addresses.',
      );
      return;
    }

    // Get current block number
    this.lastCheckedBlock = await this.blockchain.provider.getBlockNumber();
    this.logger.log(`📍 Starting from block ${this.lastCheckedBlock}`);

    this.isMonitoring = true;

    // Set up periodic refresh to pick up new deposit addresses
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(async () => {
      await this.refreshDepositAddresses();
    }, 30000);

    // Set up polling for new blocks and check for deposits
    // Poll every 12 seconds (Base block time is ~2s, so this checks multiple blocks)
    this.pollingInterval = setInterval(async () => {
      await this.pollForDeposits();
    }, 12000);

    this.logger.log('✅ Deposit monitoring active (polling mode)');
  }

  /**
   * Polls for new Transfer events since the last checked block
   * This avoids the "filter not found" error from long-lived event filters
   */
  private async pollForDeposits() {
    try {
      const currentBlock = await this.blockchain.provider.getBlockNumber();

      // Skip if no new blocks
      if (currentBlock <= this.lastCheckedBlock) {
        return;
      }

      // Query Transfer events for our deposit addresses
      // Limit to 1000 blocks at a time to avoid RPC limits
      const fromBlock = this.lastCheckedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 1000);

      // Create filter for transfers TO our deposit addresses
      const addresses = Array.from(this.depositAddresses.keys());

      if (addresses.length === 0) {
        this.lastCheckedBlock = currentBlock;
        return;
      }

      // Query logs (this uses eth_getLogs which doesn't expire like filters)
      const filter = this.usdcContract.filters.Transfer(null, addresses);
      const logs = await this.usdcContract.queryFilter(
        filter,
        fromBlock,
        toBlock,
      );

      // Process each deposit
      for (const log of logs) {
        // Type guard for EventLog
        if ('args' in log) {
          const to = log.args[1]?.toLowerCase();
          const amount = log.args[2];

          const user = this.depositAddresses.get(to);
          if (user && amount) {
            this.logger.log(
              `💰 Deposit detected! ${ethers.formatUnits(amount, 6)} USDC → ${log.args[1]}`,
            );
            this.logger.log(`   User: ${user.userWhatsAppId}`);
            this.logger.log(`   Block: ${log.blockNumber}`);
            this.logger.log(`   TX: ${log.transactionHash}`);

            // Process the deposit
            await this.processDeposit(user, amount);
          }
        }
      }

      // Update last checked block
      this.lastCheckedBlock = toBlock;

      if (logs.length > 0) {
        this.logger.log(
          `🔍 Scanned blocks ${fromBlock}-${toBlock}: Found ${logs.length} deposits`,
        );
      }
    } catch (error) {
      this.logger.error('Error polling for deposits:', error);
    }
  }

  /**
   * Refreshes the list of deposit addresses from the database
   * This picks up newly created wallets
   */
  private async refreshDepositAddresses() {
    const users = await this.usersRepo
      .createQueryBuilder('user')
      .where('user.depositAddress IS NOT NULL')
      .getMany();

    const previousCount = this.depositAddresses.size;
    this.depositAddresses.clear();

    users.forEach((user) => {
      if (user.depositAddress) {
        this.depositAddresses.set(user.depositAddress.toLowerCase(), user);
      }
    });

    const newCount = this.depositAddresses.size;

    if (newCount !== previousCount) {
      this.logger.log(
        `🔄 Deposit addresses updated: ${previousCount} → ${newCount}`,
      );
      this.logger.log(`👀 Now monitoring ${newCount} deposit addresses`);
    }
  }

  /**
   * Stops monitoring deposit addresses
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      this.logger.warn('Deposit monitoring not running');
      return;
    }

    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Clear polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // No need to remove event listeners since we're not using them anymore
    this.isMonitoring = false;
    this.depositAddresses.clear();
    this.lastCheckedBlock = 0;
    this.logger.log('🛑 Deposit monitoring stopped');
  }

  /**
   * Processes a detected deposit:
   * 1. Sweep USDC from deposit address to hot wallet
   * 2. Credit user's balance in factory contract
   */
  private async processDeposit(user: User, amount: bigint) {
    try {
      if (
        !user.depositAddress ||
        user.derivationIndex === null ||
        user.derivationIndex === undefined
      ) {
        this.logger.error(`User ${user.userWhatsAppId} missing deposit info`);
        return;
      }

      const usdcAddress = this.config.getOrThrow<string>('USDC_ADDRESS');
      const hotWallet = this.config.getOrThrow<string>('HOT_WALLET_ADDRESS');
      const hotWalletPrivateKey = this.config.getOrThrow<string>('PRIVATE_KEY');

      this.logger.log(`🔄 Processing deposit for ${user.userWhatsAppId}...`);

      // Step 1: Sweep to hot wallet
      this.logger.log('   1️⃣ Sweeping to hot wallet...');
      const sweepTxHash = await this.deposit.sweepDeposit(
        user.derivationIndex,
        hotWallet,
        usdcAddress,
        this.blockchain.provider,
        hotWalletPrivateKey,
      );

      if (!sweepTxHash) {
        this.logger.warn(
          '   ⚠️  No balance to sweep (might have been swept already)',
        );
        return;
      }

      this.logger.log(`   ✅ Swept: ${sweepTxHash}`);

      // Step 2: Credit in factory contract
      this.logger.log('   2️⃣ Crediting in factory contract...');
      await this.blockchain.depositToken(
        user.userWhatsAppId,
        usdcAddress,
        amount,
      );

      this.logger.log(
        `   ✅ Deposited ${ethers.formatUnits(amount, 6)} USDC for ${user.userWhatsAppId}`,
      );
      this.logger.log('🎉 Deposit processed successfully!');
    } catch (error) {
      this.logger.error(
        `Error processing deposit for ${user.userWhatsAppId}:`,
        error,
      );
      // TODO: Implement retry logic or alert system
    }
  }

  /**
   * Manually triggers deposit check for a specific user
   * Useful for testing or recovering from failures
   */
  async checkDeposit(userWhatsAppId: string): Promise<void> {
    const user = await this.usersRepo.findOne({
      where: { userWhatsAppId },
    });

    if (!user || !user.depositAddress) {
      throw new Error('User not found or no deposit address');
    }

    const balance = await this.usdcContract.balanceOf(user.depositAddress);

    this.logger.log(
      `Balance at ${user.depositAddress}: ${ethers.formatUnits(balance, 6)} USDC`,
    );

    if (balance > 0n) {
      this.logger.log('Processing deposit...');
      await this.processDeposit(user, balance);
    } else {
      this.logger.log('No balance to process');
    }
  }

  /**
   * Gets monitoring status
   */
  async getStatus(): Promise<{
    monitoring: boolean;
    addressCount: number;
    lastCheckedBlock: number;
    currentBlock: number;
  }> {
    const currentBlock = await this.blockchain.provider.getBlockNumber();
    return {
      monitoring: this.isMonitoring,
      addressCount: this.depositAddresses.size,
      lastCheckedBlock: this.lastCheckedBlock,
      currentBlock: currentBlock,
    };
  }

  /**
   * Manually adds a new deposit address to monitoring
   * Useful for immediately registering newly created wallets without waiting for refresh
   */
  async addDepositAddress(user: User) {
    if (user.depositAddress && this.isMonitoring) {
      this.depositAddresses.set(user.depositAddress.toLowerCase(), user);
      this.logger.log(
        `➕ Added deposit address to monitoring: ${user.depositAddress} (${user.userWhatsAppId})`,
      );
      this.logger.log(
        `👀 Now monitoring ${this.depositAddresses.size} deposit addresses`,
      );
    }
  }
}
