import * as randomstring from 'randomstring';

export function generateOtp(): string {
  const otp = randomstring.generate({
    length: 6,
    charset: 'numeric',
  });
  return otp;
}

export function generateReferral(): string {
  const referral = randomstring.generate({
    length: 10,
    charset: 'alphanumeric',
  });
  return referral;
}
