import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { UsersService } from '../users/users.service';
import { FxService } from '../fx/fx.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';

const CreateWalletDto = z.object({ userId: z.string().min(3) });

@Controller()
export class WalletController {
  constructor(
    private readonly users: UsersService,
    private readonly fx: FxService,
    private readonly chain: BlockchainService,
  ) {}

  @Post('create-wallet')
  async createWallet(@Body() body: unknown) {
    const { userId } = CreateWalletDto.parse(body);
    const walletAddress = await this.chain.createWallet(userId);
    await this.users.create(userId, walletAddress);
    return { walletAddress, success: true };
  }

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    const user = await this.users.getByUserIdOrThrow(userId);
    const usdcAddr = process.env.USDC_ADDRESS ?? '';
    const usdtAddr = process.env.USDT_ADDRESS ?? '';
    const [usdcBal, usdtBal] = await Promise.all([
      this.chain.getBalance(user.walletAddress, usdcAddr),
      this.chain.getBalance(user.walletAddress, usdtAddr),
    ]);
    const usdcAmount = ethers.formatUnits(usdcBal, 6);
    const usdtAmount = ethers.formatUnits(usdtBal, 6);
    const rates = await this.fx.getRates();
    const response = {
      tokens: {
        USDC: {
          amount: usdcAmount,
          usd: usdcAmount,
          ngn: this.fx.convert(usdcAmount, 'NGN', rates),
          eur: this.fx.convert(usdcAmount, 'EUR', rates),
        },
        USDT: {
          amount: usdtAmount,
          usd: usdtAmount,
          ngn: this.fx.convert(usdtAmount, 'NGN', rates),
          eur: this.fx.convert(usdtAmount, 'EUR', rates),
        },
      },
      total: {
        usd: (parseFloat(usdcAmount) + parseFloat(usdtAmount)).toFixed(2),
        ngn: (
          parseFloat(this.fx.convert(usdcAmount, 'NGN', rates)) +
          parseFloat(this.fx.convert(usdtAmount, 'NGN', rates))
        ).toFixed(2),
        eur: (
          parseFloat(this.fx.convert(usdcAmount, 'EUR', rates)) +
          parseFloat(this.fx.convert(usdtAmount, 'EUR', rates))
        ).toFixed(2),
      },
    };
    return response;
  }
}
