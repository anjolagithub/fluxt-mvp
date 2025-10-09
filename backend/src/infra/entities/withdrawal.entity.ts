import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (u) => u.withdrawals, { nullable: true })
  @JoinColumn({ name: 'userid' })
  user!: User | null;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  token!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  ngnEquivalent!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
