import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../common/authed-request';
import { Product } from '../products/product.entity';
import { Role } from '../users/user.entity';
import { Order, OrderStatus } from './order.entity';
import { OrdersService } from './orders.service';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const customer: AuthUser = { id: USER, email: 'c@test.com', role: Role.CUSTOMER };
const stranger: AuthUser = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 's@test.com', role: Role.CUSTOMER };
const admin: AuthUser = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'a@test.com', role: Role.ADMIN };

const product = (id: string, price: number, stock: number, isActive = true) =>
  ({ id, name: `P-${id.slice(0, 2)}`, price, stock, isActive }) as Product;

describe('OrdersService', () => {
  let service: OrdersService;
  let em: Record<'find' | 'findOne' | 'decrement' | 'increment' | 'create' | 'save', jest.Mock>;
  let repo: { findOne: jest.Mock; findAndCount: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    em = {
      find: jest.fn(),
      findOne: jest.fn(),
      decrement: jest.fn(),
      increment: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(async (x: object) => ({ id: 'order-1', ...x })),
    };
    repo = { findOne: jest.fn(), findAndCount: jest.fn(), delete: jest.fn() };
    const dataSource = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(em)) };

    const mod = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Order), useValue: repo },
      ],
    }).compile();
    service = mod.get(OrdersService);
  });

  describe('create', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({ id: 'order-1', userId: USER, items: [] });
    });

    it('computes the total server-side in cents, snapshots prices and decrements stock', async () => {
      em.find.mockResolvedValue([product(A, 19.99, 10), product(B, 0.1, 10)]);

      await service.create(USER, { items: [{ productId: A, quantity: 3 }, { productId: B, quantity: 1 }] });

      // 19.99 * 3 + 0.10 = 60.07 (naive float math would give 60.06999...)
      expect(em.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          userId: USER,
          status: OrderStatus.PENDING,
          total: 60.07,
          items: expect.arrayContaining([
            expect.objectContaining({ productId: A, quantity: 3, unitPrice: 19.99 }),
            expect.objectContaining({ productId: B, quantity: 1, unitPrice: 0.1 }),
          ]),
        }),
      );
      expect(em.decrement).toHaveBeenCalledWith(Product, { id: A }, 'stock', 3);
      expect(em.decrement).toHaveBeenCalledWith(Product, { id: B }, 'stock', 1);
    });

    it('merges duplicate product lines into one', async () => {
      em.find.mockResolvedValue([product(A, 10, 10)]);

      await service.create(USER, { items: [{ productId: A, quantity: 1 }, { productId: A, quantity: 2 }] });

      expect(em.decrement).toHaveBeenCalledTimes(1);
      expect(em.decrement).toHaveBeenCalledWith(Product, { id: A }, 'stock', 3);
    });

    it('rejects with 409 and changes nothing when stock is insufficient', async () => {
      em.find.mockResolvedValue([product(A, 10, 2)]);

      await expect(service.create(USER, { items: [{ productId: A, quantity: 5 }] })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(em.decrement).not.toHaveBeenCalled();
      expect(em.save).not.toHaveBeenCalled();
    });

    it('rejects with 404 for a product that does not exist', async () => {
      em.find.mockResolvedValue([]);

      await expect(service.create(USER, { items: [{ productId: A, quantity: 1 }] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(em.save).not.toHaveBeenCalled();
    });

    it('rejects with 404 for an inactive product', async () => {
      em.find.mockResolvedValue([product(A, 10, 10, false)]);

      await expect(service.create(USER, { items: [{ productId: A, quantity: 1 }] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('restores stock and marks the order cancelled', async () => {
      em.findOne.mockResolvedValue({ id: 'o1', userId: USER, status: OrderStatus.PENDING });
      em.find
        .mockResolvedValueOnce([{ productId: A, quantity: 3 }]) // order items
        .mockResolvedValueOnce([]); // product lock query
      repo.findOne.mockResolvedValue({ id: 'o1', userId: USER, status: OrderStatus.CANCELLED, items: [] });

      const result = await service.cancel('o1', customer);

      expect(em.increment).toHaveBeenCalledWith(Product, { id: A }, 'stock', 3);
      expect(em.save).toHaveBeenCalledWith(expect.objectContaining({ status: OrderStatus.CANCELLED }));
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('refuses to cancel an order that is not pending', async () => {
      em.findOne.mockResolvedValue({ id: 'o1', userId: USER, status: OrderStatus.CONFIRMED });

      await expect(service.cancel('o1', customer)).rejects.toBeInstanceOf(ConflictException);
      expect(em.increment).not.toHaveBeenCalled();
    });

    it("hides another customer's order behind a 404", async () => {
      em.findOne.mockResolvedValue({ id: 'o1', userId: USER, status: OrderStatus.PENDING });

      await expect(service.cancel('o1', stranger)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    const order = { id: 'o1', userId: USER, items: [] };

    it('returns the order to its owner and to an admin', async () => {
      repo.findOne.mockResolvedValue(order);
      await expect(service.findOne('o1', customer)).resolves.toBe(order);
      await expect(service.findOne('o1', admin)).resolves.toBe(order);
    });

    it("returns 404 (not 403) for someone else's order so ids don't leak", async () => {
      repo.findOne.mockResolvedValue(order);
      await expect(service.findOne('o1', stranger)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('only deletes cancelled orders', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'o1', status: OrderStatus.PENDING });
      await expect(service.remove('o1')).rejects.toBeInstanceOf(ConflictException);

      repo.findOne.mockResolvedValueOnce({ id: 'o1', status: OrderStatus.CANCELLED });
      await service.remove('o1');
      expect(repo.delete).toHaveBeenCalledWith('o1');
    });
  });
});
