import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(
    userWhatsAppId: string,
    userAddress: string,
    depositAddress?: string,
    derivationIndex?: number,
  ): Promise<User> {
    try {
      const user = await this.usersRepo.save(
        this.usersRepo.create({
          userWhatsAppId,
          userAddress,
          depositAddress,
          derivationIndex,
        }),
      );
      return user;
    } catch (error: any) {
      // PostgreSQL unique constraint violation error code
      if (error.code === '23505') {
        if (error.detail?.includes('userWhatsAppId')) {
          throw new ConflictException(
            `User with WhatsApp ID ${userWhatsAppId} already exists`,
          );
        }
        // Generic unique constraint violation
        throw new ConflictException('User already exists');
      }

      throw error;
    }
  }

  async getByWhatsAppId(userWhatsAppId: string) {
    const user = await this.usersRepo.findOne({ where: { userWhatsAppId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getById(id: string) {
    // Check if the id is a UUID format
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const user = await this.usersRepo.findOne({
      where: isUuid ? { id } : { userWhatsAppId: id },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserCount(): Promise<number> {
    return await this.usersRepo.count();
  }

  async getAllUsers(): Promise<User[]> {
    return await this.usersRepo.find();
  }

  async findByDepositAddress(depositAddress: string): Promise<User | null> {
    return await this.usersRepo.findOne({ where: { depositAddress } });
  }
}
