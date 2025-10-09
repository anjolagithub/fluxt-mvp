import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FxService } from '../fx/fx.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { DepositService } from '../deposit/deposit.service';
import { DepositMonitorService } from '../deposit/deposit-monitor.service';

export interface WalletBalanceResponse {
  tokens: {
    USDC: {
      amount: string;
      usd: string;
      ngn: string;
    };
    USDT: {
      amount: string;
      usd: string;
      ngn: string;
    };
  };
  total: {
    usd: string;
    ngn: string;
  };
}

export interface CreateWalletResponse {
  userAddress: string;
  depositAddress: string;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly users: UsersService,
    private readonly fx: FxService,
    private readonly chain: BlockchainService,
    private readonly config: ConfigService,
    private readonly deposit: DepositService,
    private readonly depositMonitor: DepositMonitorService,
  ) {}

  /**
   * Creates a custodial wallet for a user
   */
  async createWallet(userWhatsAppId: string): Promise<CreateWalletResponse> {
    this.logger.log(`🔥 Creating wallet for user ${userWhatsAppId}...`);

    // Generate/get user address (deterministic, required by contract)
    const userAddress =
      await this.chain.getOrGenerateWalletAddress(userWhatsAppId);

    // Generate deposit address (HD wallet)
    const userCount = await this.users.getUserCount();
    const depositInfo = this.deposit.generateDepositAddress(userCount);

    this.logger.log(`   User address: ${userAddress}`);
    this.logger.log(`   Deposit address: ${depositInfo.address}`);
    this.logger.log(`   Derivation path: ${depositInfo.derivationPath}`);

    // Create user in database with both addresses
    const user = await this.users.create(
      userWhatsAppId,
      userAddress,
      depositInfo.address,
      userCount,
    );

    // Immediately register the new deposit address for monitoring
    // This ensures deposits are tracked without waiting for the 30s refresh
    await this.depositMonitor.addDepositAddress(user);

    return {
      userAddress: userAddress,
      depositAddress: depositInfo.address,
    };
  }

  /**
   * Gets the balance for a user's wallet in multiple currencies
   */
  async getBalance(userWhatsAppId: string): Promise<WalletBalanceResponse> {
    // Get user from database
    const user = await this.users.getByWhatsAppId(userWhatsAppId);

    this.logger.log(`Fetching balance for user address: ${user.userAddress}`);

    // Get token addresses from environment
    const usdcAddr = this.config.get<string>('USDC_ADDRESS', '');
    const usdtAddr = this.config.get<string>('USDT_ADDRESS', '');

    // Fetch balances from blockchain using userAddress (required by contract)
    const [usdcBal, usdtBal = 0n] = await Promise.all([
      this.chain.getBalance(user.userAddress, usdcAddr),
      // this.chain.getBalance(user.userAddress, usdtAddr),
    ]);

    // Format balances (6 decimals for USDC/USDT)
    const usdcAmount = ethers.formatUnits(usdcBal, 6);
    const usdtAmount = ethers.formatUnits(usdtBal, 6);

    // Check if total balance is zero - skip exchange rate API call
    const totalBalance = parseFloat(usdcAmount) + parseFloat(usdtAmount);

    if (totalBalance === 0) {
      this.logger.log(
        `Zero balance for user ${userWhatsAppId}, skipping exchange rate API call`,
      );

      return {
        tokens: {
          USDC: {
            amount: '0.00',
            usd: '0.00',
            ngn: '0.00',
          },
          USDT: {
            amount: '0.00',
            usd: '0.00',
            ngn: '0.00',
          },
        },
        total: {
          usd: '0.00',
          ngn: '0.00',
        },
      };
    }

    // Get exchange rates only when there's a balance
    const rates = await this.fx.getRates();

    // Build response with conversions
    const response: WalletBalanceResponse = {
      tokens: {
        USDC: {
          amount: usdcAmount,
          usd: usdcAmount,
          ngn: this.fx.convert(usdcAmount, 'NGN', rates),
        },
        USDT: {
          amount: usdtAmount,
          usd: usdtAmount,
          ngn: this.fx.convert(usdtAmount, 'NGN', rates),
        },
      },
      total: {
        usd: totalBalance.toFixed(2),
        ngn: (
          parseFloat(this.fx.convert(usdcAmount, 'NGN', rates)) +
          parseFloat(this.fx.convert(usdtAmount, 'NGN', rates))
        ).toFixed(2),
      },
    };

    return response;
  }
}
