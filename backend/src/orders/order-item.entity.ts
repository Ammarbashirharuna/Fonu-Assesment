import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';
import { Product } from '../products/product.entity';
import { Order } from './order.entity';

@Entity('order_items')
@Check('"quantity" > 0')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  // Price snapshot at order time, so later price edits don't rewrite history
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  unitPrice!: number;
}
