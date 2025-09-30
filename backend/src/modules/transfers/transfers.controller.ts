import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../infra/typeorm/entities/transaction.entity';
import { ethers } from 'ethers';

const SendDto = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  amount: z.string(),
  token: z.enum(['USDC', 'USDT']),
});

@Controller()
export class TransfersController {
  constructor(
    private readonly users: UsersService,
    private readonly chain: BlockchainService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  @Post('send')
  async send(@Body() body: unknown) {
    const { fromUserId, toUserId, amount, token } = SendDto.parse(body);
    const [fromUser, toUser] = await Promise.all([
      this.users.getByUserIdOrThrow(fromUserId),
      this.users.getByUserIdOrThrow(toUserId),
    ]);
    const tokenAddress =
      token === 'USDC' ? process.env.USDC_ADDRESS! : process.env.USDT_ADDRESS!;
    const amountWei = ethers.parseUnits(amount, 6);
    const receipt = await this.chain.sendToken(
      fromUser.walletAddress,
      toUser.walletAddress,
      tokenAddress,
      amountWei,
    );
    const txHash = receipt?.hash ?? receipt?.transactionHash;
    await this.txRepo.save(
      this.txRepo.create({
        txHash: txHash ?? null,
        fromUserId,
        toUserId,
        amount,
        currency: token,
        status: 'pending',
      }),
    );
    return { txHash, success: true };
  }
}
