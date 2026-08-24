import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthenticatedRequest {
  user?: Record<string, unknown>;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data && user ? user[data] : user;
  },
);
