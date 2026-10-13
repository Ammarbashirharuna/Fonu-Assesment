import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const ADMIN_TOKEN_TTL_SECONDS = 30 * 60;
// compared against when the email is unknown, so timing doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    // role is never taken from the client: the entity default (customer) applies
    const user = await this.users.create({ email: dto.email, passwordHash });
    return { id: user.id, email: user.email, role: user.role };
  }

  /** Customer entry point: admin credentials are rejected here. */
  async login(dto: LoginDto) {
    const user = await this.authenticate(dto, Role.CUSTOMER);
    return { access_token: await this.sign(user) };
  }

  /** Admin entry point: customer credentials are rejected here. Short-lived token. */
  async adminLogin(dto: LoginDto) {
    const user = await this.authenticate(dto, Role.ADMIN);
    return { access_token: await this.sign(user, ADMIN_TOKEN_TTL_SECONDS) };
  }

  private async authenticate(dto: LoginDto, expectedRole: Role): Promise<User> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    // one generic error for: unknown email, wrong password, wrong entry point
    if (!user || !passwordOk || user.role !== expectedRole) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  private sign(user: User, expiresIn?: number) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload, expiresIn ? { expiresIn } : undefined);
  }
}
