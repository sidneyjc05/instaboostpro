import QRCode from 'qrcode';

export interface PixPayloadOptions {
  key: string;
  name: string;
  city?: string;
  amount: number;
  txid?: string;
  description?: string;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return id + len + value;
}

export function generatePixBrCode({
  key,
  name,
  city = 'SAO PAULO',
  amount,
  txid,
  description
}: PixPayloadOptions): string {
  const cleanKey = key.trim();
  let accountInfo = formatTLV('00', 'br.gov.bcb.pix') + formatTLV('01', cleanKey);
  if (description) {
    accountInfo += formatTLV('02', description.substring(0, 50));
  }

  const cleanName = (name || 'INSTABOOST')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 25)
    .toUpperCase();

  const cleanCity = (city || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 15)
    .toUpperCase();

  let payload =
    formatTLV('00', '01') +
    formatTLV('26', accountInfo) +
    formatTLV('52', '0000') +
    formatTLV('53', '986') +
    (amount > 0 ? formatTLV('54', amount.toFixed(2)) : '') +
    formatTLV('58', 'BR') +
    formatTLV('59', cleanName) +
    formatTLV('60', cleanCity);

  const cleanTxId = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';
  payload += formatTLV('62', formatTLV('05', cleanTxId));
  payload += '6304';

  const checksum = crc16(payload);
  return payload + checksum;
}

export async function generatePixQrCodeDataUrl(pixCode: string): Promise<string> {
  try {
    return await QRCode.toDataURL(pixCode, {
      width: 350,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Error generating QR code image:', err);
    return '';
  }
}
