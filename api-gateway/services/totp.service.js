import { authenticator } from 'otplib';
import qrcode from 'qrcode';

export const generateTotpSecret = async (userEmail) => {
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(userEmail, 'FlowAPI', secret);
  const qrCodeUrl = await qrcode.toDataURL(uri);
  return { secret, qrCodeUrl };
};

export const verifyTotpToken = (secret, token) => {
  return authenticator.verify({ token, secret });
};
