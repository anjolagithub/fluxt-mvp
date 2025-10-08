import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { Paylink } from './paylink.entity';
import { Withdrawal } from './withdrawal.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  userId!: string;

  @Column({ type: 'varchar', length: 42 })
  walletAddress!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => Transaction, (t) => t.fromUser)
  transactionsFrom!: Transaction[];

  @OneToMany(() => Transaction, (t) => t.toUser)
  transactionsTo!: Transaction[];

  @OneToMany(() => Paylink, (p) => p.user)
  paylinks!: Paylink[];

  @OneToMany(() => Withdrawal, (w) => w.user)
  withdrawals!: Withdrawal[];
}
