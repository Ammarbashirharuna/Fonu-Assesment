import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';

// escape LIKE wildcards so a search for "100%" matches literally
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly repo: Repository<Product>) {}

  async findAll(q: ListProductsDto, isAdmin: boolean) {
    const qb = this.repo.createQueryBuilder('p');

    if (!(isAdmin && q.includeInactive)) {
      qb.andWhere('p.isActive = true');
    }
    if (q.search) {
      qb.andWhere('p.name ILIKE :search', { search: `%${escapeLike(q.search)}%` });
    }

    qb.orderBy(`p.${q.sortBy}`, q.order)
      .addOrderBy('p.id', 'ASC') // stable order so pages never overlap
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }

  async findOne(id: string, isAdmin: boolean) {
    const product = await this.repo.findOne({ where: { id } });
    // inactive products look "not found" to customers
    if (!product || (!product.isActive && !isAdmin)) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  create(dto: CreateProductDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id, true);
    Object.assign(product, dto);
    return this.repo.save(product);
  }

  // soft delete: order_items reference products with ON DELETE RESTRICT
  async deactivate(id: string) {
    const product = await this.findOne(id, true);
    if (product.isActive) {
      product.isActive = false;
      await this.repo.save(product);
    }
  }
}
