import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController Google sign-in', () => {
  const authService = {
    createGoogleAuthorizationLink: jest.fn(),
    handleGoogleAuthorizationCallback: jest.fn(),
    exchangeGoogleHandoffCode: jest.fn(),
  };
  const controller = new AuthController(authService as unknown as AuthService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the Google authorization link', async () => {
    authService.createGoogleAuthorizationLink.mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/authorize',
    });

    await expect(controller.googleAuthorizationLink()).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/authorize',
    });
  });

  it('redirects the Google callback to the frontend handoff URL', async () => {
    const redirect = jest.fn().mockReturnValue(undefined);
    const response = {
      redirect,
    } as unknown as Response;
    authService.handleGoogleAuthorizationCallback.mockResolvedValue({
      redirectUrl: 'https://app.example.com/auth/google?code=handoff-code',
    });

    await controller.googleAuthorizationCallback(
      'authorization-code',
      'oauth-state',
      response,
    );

    expect(authService.handleGoogleAuthorizationCallback).toHaveBeenCalledWith(
      'authorization-code',
      'oauth-state',
    );
    expect(redirect).toHaveBeenCalledWith(
      302,
      'https://app.example.com/auth/google?code=handoff-code',
    );
  });

  it('delegates handoff code exchange to the auth service', async () => {
    authService.exchangeGoogleHandoffCode.mockResolvedValue({
      token: 'application-jwt',
    });

    await expect(
      controller.exchangeGoogleAuthorizationCode({ code: 'handoff-code' }),
    ).resolves.toEqual({ token: 'application-jwt' });
    expect(authService.exchangeGoogleHandoffCode).toHaveBeenCalledWith({
      code: 'handoff-code',
    });
  });
});
