import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { Product } from '../products/product.entity';
import { Role, User } from '../users/user.entity';

const DEMO_PRODUCTS = [
  { name: 'Wireless Mouse', description: 'Ergonomic 2.4 GHz mouse with silent clicks.', price: 24.99, stock: 40 },
  { name: 'Mechanical Keyboard', description: 'Compact 75% layout with hot-swappable switches.', price: 89.5, stock: 25 },
  { name: 'USB-C Hub 7-in-1', description: 'HDMI, SD reader, 3 USB-A ports and 100 W pass-through.', price: 45, stock: 60 },
  { name: 'Laptop Stand', description: 'Adjustable aluminium stand for 10 to 17 inch laptops.', price: 32.0, stock: 3 },
  { name: 'Webcam 1080p', description: 'Full HD webcam with privacy shutter.', price: 54.9, stock: 0 },
];

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(User);
    const existing = await users.findOne({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      await users.save(users.create({ email, passwordHash, role: Role.ADMIN }));
      console.log(`Created admin: ${email}`);
    } else if (existing.role !== Role.ADMIN) {
      await users.update({ id: existing.id }, { role: Role.ADMIN });
      console.log(`Promoted existing user to admin: ${email}`);
    } else {
      console.log(`Admin already exists: ${email} (nothing to do)`);
    }

    // demo catalogue: only when the table is empty, so restarts never duplicate or overwrite
    const products = dataSource.getRepository(Product);
    if ((await products.count()) === 0) {
      await products.save(DEMO_PRODUCTS.map((p) => products.create(p)));
      console.log(`Seeded ${DEMO_PRODUCTS.length} demo products`);
    } else {
      console.log('Products already present (skipping demo catalogue)');
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
