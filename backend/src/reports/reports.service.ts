import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/order.entity';
import { SummaryQueryDto } from './dto/summary-query.dto';

const MAX_ORDERS = 5000;
const TIMEOUT_MS = 3000;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly config: ConfigService,
  ) {}

  async summary(q: SummaryQueryDto) {
    // cancelled orders are not revenue
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'i')
      .leftJoinAndSelect('i.product', 'p')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED });
    if (q.from) qb.andWhere('o.created_at >= :from', { from: q.from });
    if (q.to) qb.andWhere('o.created_at <= :to', { to: q.to });
    const orders = await qb.orderBy('o.created_at', 'DESC').take(MAX_ORDERS).getMany();

    const payload = {
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: o.total,
        items: o.items.map((i) => ({
          productId: i.productId,
          name: i.product?.name ?? '',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })),
    };

    const base = this.config.get<string>('REPORTING_URL', 'http://localhost:8090');
    const key = this.config.get<string>('REPORTING_API_KEY', '');
    try {
      const res = await fetch(`${base}/v1/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`reporting service responded ${res.status}`);
      const summary = await res.json();
      return { range: { from: q.from ?? null, to: q.to ?? null }, ...summary };
    } catch (err) {
      this.logger.error(`Reporting service call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Reporting service is unavailable, try again later');
    }
  }
}
