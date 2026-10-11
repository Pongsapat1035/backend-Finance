import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('GET /me', () => {
  it('registers a protected GET /me route', () => {
    const routeHandler = Reflect.get(
      UserController.prototype,
      'getMe',
    ) as object;

    expect(Reflect.getMetadata(PATH_METADATA, UserController)).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe('me');
    expect(Reflect.getMetadata(METHOD_METADATA, routeHandler)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, UserController)).toContain(
      JwtAuthGuard,
    );
  });

  it('looks up the authenticated user', async () => {
    const profile = { id: 7, email: 'user@example.com' };
    const userService = { getMe: jest.fn().mockResolvedValue(profile) };
    const controller = new UserController(
      userService as unknown as UserService,
    );

    await expect(controller.getMe(7)).resolves.toBe(profile);
    expect(userService.getMe).toHaveBeenCalledWith(7);
  });
});
