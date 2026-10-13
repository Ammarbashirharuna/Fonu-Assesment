import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

// Entities are imported explicitly (no globs), so this works the same under
// ts-node (src) and compiled output (dist, Docker). Migrations use a
// __dirname glob, which resolves correctly in both.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Product, Order, OrderItem],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
