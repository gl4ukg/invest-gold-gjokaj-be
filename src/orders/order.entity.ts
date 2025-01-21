import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Products } from '../products/products.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  guestEmail: string;

  @ManyToOne(() => Products, (product) => product.orders)
  @JoinColumn({ name: 'product_id' })
  product: Products;

  @Column()
  quantity: number;

  @Column()
  totalPrice: number;

  @Column()
  shippingAddress: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  postalCode: string;

  @Column()
  country: string;
}
