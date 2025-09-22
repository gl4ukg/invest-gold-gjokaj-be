import { Categories } from '../categories/categories.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Products {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true, generated: 'increment', nullable: true })
  numericId: number;

  @Column()
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  description: {
    en: string;
    de: string;
    sq: string;
  } | string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column()
  weight: string;

  @Column()
  stock: number;

  @Column('text', { array: true, nullable: true })
  images: string[];

  @ManyToOne(() => Categories, (category) => category.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Categories;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
