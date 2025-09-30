import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet, ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/typeorm/entities/user.entity';
import { Transaction } from '../../infra/typeorm/entities/transaction.entity';

@Injectable()
export class BlockchainService implements OnModuleInit {
  readonly provider: JsonRpcProvider;
  readonly wallet: Wallet;
  readonly contract: Contract;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {
    const rpcUrl = this.config.get<string>('MUMBAI_RPC_URL');
    const privateKey = this.config.get<string>('PRIVATE_KEY');
    const contractAddress = this.config.get<string>('CONTRACT_ADDRESS');
    const abi = JSON.parse(
      this.config.get<string>('CONTRACT_ABI_JSON') ?? '[]',
    );

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey ?? '', this.provider);
    this.contract = new Contract(contractAddress ?? '', abi, this.wallet);
  }

  async onModuleInit(): Promise<void> {
    try {
      this.contract.on(
        'WalletCreated',
        async (user: string, wallet: string) => {
          const existing = await this.usersRepo.findOne({
            where: { userId: user },
          });
          if (existing) {
            existing.walletAddress = wallet;
            await this.usersRepo.save(existing);
          } else {
            await this.usersRepo.save(
              this.usersRepo.create({ userId: user, walletAddress: wallet }),
            );
          }
        },
      );
      this.contract.on(
        'TokenSent',
        async (from: string, to: string, token: string, amount: bigint) => {
          await this.txRepo.save(
            this.txRepo.create({
              fromUserId: from,
              toUserId: to,
              amount: ethers.formatUnits(amount, 6),
              currency: token === process.env.USDC_ADDRESS ? 'USDC' : 'USDT',
              status: 'confirmed',
            }),
          );
        },
      );
      this.contract.on('TokenReceived', async () => {
        // Could update balances or create inbound transaction records
      });
    } catch (e) {
      // ignore listener errors in init
    }
  }

  async createWallet(userId: string): Promise<string> {
    const tx = await this.contract.createWallet(userId);
    const receipt = await tx.wait();
    const evt = receipt.logs
      .map((l: any) => this.contract.interface.parseLog(l)?.args)
      .find((a: any) => a && a.wallet);
    return evt?.wallet as string;
  }

  getBalance(userAddress: string, tokenAddress: string) {
    return this.contract.getBalance(userAddress, tokenAddress);
  }

  async sendToken(from: string, to: string, token: string, amount: bigint) {
    const tx = await this.contract.sendToken(from, to, token, amount);
    return tx.wait();
  }
}
