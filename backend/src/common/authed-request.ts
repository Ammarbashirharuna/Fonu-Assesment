import { Role } from '../users/user.entity';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthedRequest {
  user: AuthUser;
}
