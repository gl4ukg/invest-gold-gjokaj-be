import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ShippingAddress } from './shipping-address.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items: OrderItem[];

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2 })
  shippingCost: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column()
  paymentMethod: string;

  @Column()
  shippingMethod: string;

  @OneToOne(() => ShippingAddress, address => address.order, { cascade: true })
  @JoinColumn()
  shippingAddress: ShippingAddress;

  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 'pending' })
  paymentStatus: 'pending' | 'success' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
