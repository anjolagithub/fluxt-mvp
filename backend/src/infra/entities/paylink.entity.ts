import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('paylinks')
export class Paylink {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id!: string;

  @ManyToOne(() => User, (u) => u.paylinks, { nullable: true })
  @JoinColumn({ name: 'userid' })
  user!: User | null;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  token!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;
}
