import { Order } from "src/orders/order.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

// src/payment/entities/payment-transaction.entity.ts
@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bankartTransactionId: string; // = purchaseId returned from Bankart

  @Column()
  merchantTransactionId: string;  // = your order ID

  @Column({ nullable: true })
  uuid: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: string; // 'pending' | 'completed' | 'failed' | 'refunded'

  @Column({ nullable: true })
  redirectUrl?: string; 

  @Column({ nullable: true })
  errorMessage?: string;

  @OneToOne(() => Order)
  @JoinColumn()
  order: Order;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}