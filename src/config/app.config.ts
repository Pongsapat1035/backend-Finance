import { registerAs } from '@nestjs/config';

type Environment = Record<string, unknown>;

const requiredVariables = [
  'JWT_SECRET',
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
] as const;

export const appConfig = registerAs('app', () => ({
  jwtSecret: process.env.JWT_SECRET!,
  frontendUrl: process.env.FRONTEND_URL!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  },
}));

export function validateEnvironment(environment: Environment): Environment {
  const validatedEnvironment = { ...environment };

  for (const variableName of requiredVariables) {
    const value = environment[variableName];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${variableName} must be configured.`);
    }
    validatedEnvironment[variableName] = value.trim();
  }

  validateHttpUrl(validatedEnvironment, 'FRONTEND_URL');
  validateHttpUrl(validatedEnvironment, 'GOOGLE_REDIRECT_URI');

  return validatedEnvironment;
}

function validateHttpUrl(environment: Environment, variableName: string) {
  const value = environment[variableName];

  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch {
    throw new Error(`${variableName} must be a valid HTTP(S) URL.`);
  }
}
