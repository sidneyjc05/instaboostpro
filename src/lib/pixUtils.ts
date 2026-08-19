import { crc16ccitt } from 'crc';

function padLength(str: string | number) {
  return String(str).length.toString().padStart(2, '0');
}

export function generatePixPayload(key: string, amount: number, name = 'Reembolso', city = 'SP') {
  const amountStr = amount.toFixed(2);
  
  // Format key
  const gui = '0014br.gov.bcb.pix';
  const keyF = `01${padLength(key)}${key}`;
  const merchantAccount = `26${padLength(gui + keyF)}${gui}${keyF}`;
  
  const merchantCategory = `52040000`;
  const transactionCurrency = `5303986`;
  const transactionAmount = amount > 0 ? `54${padLength(amountStr)}${amountStr}` : '';
  const countryCode = `5802BR`;
  const merchantName = `59${padLength(name)}${name}`;
  const merchantCity = `60${padLength(city)}${city}`;
  
  const txid = '***';
  const additionalData = `62${padLength(`0503***`)}0503***`;

  const payload = `000201${merchantAccount}${merchantCategory}${transactionCurrency}${transactionAmount}${countryCode}${merchantName}${merchantCity}${additionalData}6304`;
  
  const crc = crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0');
  return payload + crc;
}
