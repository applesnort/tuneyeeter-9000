import jwt from 'jsonwebtoken';

export function generateMusicKitToken(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const keyId = process.env.APPLE_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!privateKey || !keyId || !teamId) {
    throw new Error('Missing Apple Music API credentials');
  }

  const payload = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 180), // 180 days
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  });

  return token;
}