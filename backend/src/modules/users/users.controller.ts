import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.users.getByUserIdOrThrow(userId);
  }
}
