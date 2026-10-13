import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { AuthUser } from '../common/authed-request';
import { Product } from '../products/product.entity';
import { Role } from '../users/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

interface OrderLine {
  productId: string;
  quantity: number;
  unitPrice: number;
}

const toCents = (n: number) => Math.round(n * 100);

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // merge duplicate lines, then sort ids: consistent lock order prevents deadlocks
    const wanted = new Map<string, number>();
    for (const line of dto.items) {
      wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
    }
    const ids = [...wanted.keys()].sort();

    const orderId = await this.dataSource.transaction(async (em) => {
      // row locks held until commit: concurrent orders for the same products queue up here
      const products = await em.find(Product, {
        where: { id: In(ids) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const missing: string[] = [];
      const short: string[] = [];
      const lines: OrderLine[] = [];
      let totalCents = 0;

      for (const id of ids) {
        const qty = wanted.get(id)!;
        const p = byId.get(id);
        if (!p || !p.isActive) {
          missing.push(id);
          continue;
        }
        if (p.stock < qty) {
          short.push(`"${p.name}": requested ${qty}, available ${p.stock}`);
          continue;
        }
        lines.push({ productId: id, quantity: qty, unitPrice: p.price });
        totalCents += toCents(p.price) * qty;
      }

      if (missing.length) {
        throw new NotFoundException(`Products not found or unavailable: ${missing.join(', ')}`);
      }
      if (short.length) {
        throw new ConflictException(`Insufficient stock for ${short.join('; ')}`);
      }

      for (const line of lines) {
        await em.decrement(Product, { id: line.productId }, 'stock', line.quantity);
      }

      const order = await em.save(
        em.create(Order, {
          userId,
          status: OrderStatus.PENDING,
          total: totalCents / 100,
          items: lines,
        }),
      );
      return order.id;
    });

    return this.findOne(orderId, { id: userId, email: '', role: Role.CUSTOMER });
  }

  async findAll(q: ListOrdersDto, actor: AuthUser) {
    const where: FindOptionsWhere<Order> = {};
    if (actor.role !== Role.ADMIN) where.userId = actor.id;
    if (q.status) where.status = q.status;

    const [data, total] = await this.orders.findAndCount({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });

    return {
      data,
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    };
  }

  async findOne(id: string, actor: AuthUser) {
    const order = await this.orders.findOne({ where: { id }, relations: { items: true } });
    // someone else's order looks "not found": ids must not leak existence
    if (!order || (actor.role !== Role.ADMIN && order.userId !== actor.id)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async confirm(id: string, actor: AuthUser) {
    await this.dataSource.transaction(async (em) => {
      const order = await this.lockOrder(em, id, actor);
      this.assertPending(order, 'confirmed');
      order.status = OrderStatus.CONFIRMED;
      await em.save(order);
    });
    return this.findOne(id, actor);
  }

  async cancel(id: string, actor: AuthUser) {
    await this.dataSource.transaction(async (em) => {
      const order = await this.lockOrder(em, id, actor);
      this.assertPending(order, 'cancelled');

      const items = await em.find(OrderItem, { where: { orderId: id } });
      if (items.length) {
        // lock products in id order (same as create) before giving stock back
        await em.find(Product, {
          where: { id: In(items.map((i) => i.productId)) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        for (const item of items) {
          await em.increment(Product, { id: item.productId }, 'stock', item.quantity);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await em.save(order);
    });
    return this.findOne(id, actor);
  }

  /** Admin-only. Only cancelled orders (stock already restored) may be deleted. */
  async remove(id: string) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.CANCELLED) {
      throw new ConflictException(
        `Only cancelled orders can be deleted (current status: ${order.status})`,
      );
    }
    await this.orders.delete(id); // order_items rows go with it (ON DELETE CASCADE)
  }

  private async lockOrder(em: EntityManager, id: string, actor: AuthUser) {
    const order = await em.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!order || (actor.role !== Role.ADMIN && order.userId !== actor.id)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private assertPending(order: Order, target: string) {
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        `Only pending orders can be ${target} (current status: ${order.status})`,
      );
    }
  }
}
