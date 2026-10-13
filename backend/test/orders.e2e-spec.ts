import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Role, User } from '../src/users/user.entity';

jest.setTimeout(30_000);

describe('Orders flow (e2e)', () => {
  let app: INestApplication;
  let adminToken = '';
  let customerToken = '';
  const stamp = Date.now();
  const password = 'Password123!';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const createProduct = async (stock: number, price = 12.5) => {
    const res = await api()
      .post('/api/v1/products')
      .set(auth(adminToken))
      .send({ name: `E2E ${stamp} ${Math.random().toString(36).slice(2, 7)}`, price, stock })
      .expect(201);
    return res.body.id as string;
  };
  const stockOf = async (id: string) =>
    (await api().get(`/api/v1/products/${id}`).set(auth(customerToken)).expect(200)).body.stock as number;
  const order = (productId: string, quantity: number) =>
    api().post('/api/v1/orders').set(auth(customerToken)).send({ items: [{ productId, quantity }] });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // admins are never self-registered: insert one directly
    const adminEmail = `admin-${stamp}@e2e.test`;
    await app.get(DataSource).getRepository(User).save({
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
    });
    adminToken = (await api().post('/api/v1/auth/admin/login').send({ email: adminEmail, password }).expect(200))
      .body.access_token;

    const customerEmail = `customer-${stamp}@e2e.test`;
    await api().post('/api/v1/auth/register').send({ email: customerEmail, password }).expect(201);
    customerToken = (await api().post('/api/v1/auth/login').send({ email: customerEmail, password }).expect(200))
      .body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('places an order, computes the total and decrements stock', async () => {
    const id = await createProduct(5, 12.5);
    const res = await order(id, 2).expect(201);
    expect(res.body.total).toBe(25);
    expect(res.body.status).toBe('pending');
    expect(res.body.items[0]).toMatchObject({ productId: id, quantity: 2, unitPrice: 12.5 });
    expect(await stockOf(id)).toBe(3);
  });

  it('returns 409 when stock is insufficient and leaves stock untouched', async () => {
    const id = await createProduct(2);
    await order(id, 5).expect(409);
    expect(await stockOf(id)).toBe(2);
  });

  it('enforces authentication and roles', async () => {
    await api().get('/api/v1/orders').expect(401);
    await api().post('/api/v1/products').set(auth(customerToken)).send({ name: 'x', price: 1, stock: 1 }).expect(403);
    await api().post('/api/v1/auth/admin/login').send({ email: `customer-${stamp}@e2e.test`, password }).expect(401);
  });

  it('validates input', async () => {
    const id = await createProduct(5);
    await api().post('/api/v1/orders').set(auth(customerToken)).send({ items: [] }).expect(400);
    await order(id, 0).expect(400);
  });

  it('cancelling restores stock', async () => {
    const id = await createProduct(5);
    const placed = await order(id, 3).expect(201);
    expect(await stockOf(id)).toBe(2);
    await api().post(`/api/v1/orders/${placed.body.id}/cancel`).set(auth(customerToken)).expect(200);
    expect(await stockOf(id)).toBe(5);
  });

  it('never oversells under concurrent orders (10 parallel, stock 5)', async () => {
    const id = await createProduct(5, 10);
    const results = await Promise.all(Array.from({ length: 10 }, () => order(id, 1)));
    const codes = results.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(5);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    expect(await stockOf(id)).toBe(0);
  });
});
