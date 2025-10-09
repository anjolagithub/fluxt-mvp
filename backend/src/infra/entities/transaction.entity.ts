import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 66, nullable: true, unique: true })
  txHash!: string | null;

  @ManyToOne(() => User, (u) => u.transactionsFrom, { nullable: true })
  @JoinColumn({ name: 'fromid' })
  fromUser!: User | null;

  @ManyToOne(() => User, (u) => u.transactionsTo, { nullable: true })
  @JoinColumn({ name: 'toid' })
  toUser!: User | null;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
