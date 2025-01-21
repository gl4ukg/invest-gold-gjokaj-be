import { Categories } from 'src/categories/categories.entity';
import { Order } from 'src/orders/order.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';

@Entity('products')
export class Products {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  price: number;

  @Column()
  stock: number;

  @Column()
  image: string;

  @ManyToOne(() => Categories, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Categories;

  @OneToMany(() => Order, (order) => order.product)
  orders: Order[];
}
