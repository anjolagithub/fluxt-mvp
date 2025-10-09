import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';

export interface SendTokenResponse {
  txHash: string;
}

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly users: UsersService,
    private readonly chain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sends tokens from one user to another
   */
  async sendToken(
    fromid: string,
    toid: string,
    amount: string,
    token: 'USDC' | 'USDT',
  ): Promise<SendTokenResponse> {
    try {
      // Get users from database
      const [fromUser, toUser] = await Promise.all([
        this.users.getById(fromid),
        this.users.getById(toid),
      ]);

      // Get token address from environment
      const tokenAddress =
        token === 'USDC'
          ? this.config.getOrThrow<string>('USDC_ADDRESS')
          : this.config.getOrThrow<string>('USDT_ADDRESS');

      // Convert amount to wei (6 decimals for USDC/USDT)
      const amountWei = ethers.parseUnits(amount, 6);

      // Send token on blockchain using userAddress (required by contract)
      // Note: blockchain.service.ts already saves the transaction to DB
      const receipt = await this.chain.sendToken(
        fromUser.userAddress,
        toUser.userAddress,
        tokenAddress,
        amountWei,
      );

      // Extract transaction hash
      const txHash = receipt?.hash ?? receipt?.transactionHash;

      return { txHash };
    } catch (error) {
      this.logger.error('Error in sendToken:', error);
      throw error;
    }
  }
}
