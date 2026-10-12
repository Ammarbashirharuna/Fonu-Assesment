import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { Role, User } from '../users/user.entity';

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      await repo.save(repo.create({ email, passwordHash, role: Role.ADMIN }));
      console.log(`Created admin: ${email}`);
    } else if (existing.role !== Role.ADMIN) {
      await repo.update({ id: existing.id }, { role: Role.ADMIN });
      console.log(`Promoted existing user to admin: ${email}`);
    } else {
      console.log(`Admin already exists: ${email} (nothing to do)`);
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
