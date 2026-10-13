import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthedRequest } from '../common/authed-request';
import { Role } from '../users/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: AuthedRequest) {
    return this.orders.create(req.user.id, dto);
  }

  @Get()
  list(@Query() query: ListOrdersDto, @Req() req: AuthedRequest) {
    return this.orders.findAll(query, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.orders.findOne(id, req.user);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.orders.confirm(id, req.user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.orders.cancel(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.remove(id);
  }
}
