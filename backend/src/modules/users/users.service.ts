import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  create(userId: string, walletAddress: string) {
    return this.usersRepo.save(
      this.usersRepo.create({ userId, walletAddress }),
    );
  }

  async getByUserIdOrThrow(userId: string) {
    const user = await this.usersRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
