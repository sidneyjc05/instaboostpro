import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  increment,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { sendNotification } from './notifications';
import { generatePixBrCode, generatePixQrCodeDataUrl } from './pix';

export interface StoreConfig {
  coins: Record<string, number>;
  tickets: Record<string, number>;
  plans: Record<string, number>;
  promo: {
    active: boolean;
    type: string;
    value: number;
    expiresAt: string | null;
    applyCoins?: boolean;
    applyTickets?: boolean;
    applyPlanBasic?: boolean;
    applyPlanPro?: boolean;
    applyPlanPremium?: boolean;
    applyPlanUltra?: boolean;
  };
}

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  coins: {
    110: 0.50,
    230: 1.00,
    480: 2.00,
    1150: 5.00,
    2300: 10.00,
    4200: 20.00,
    5100: 50.00,
    5800: 100.00,
    6500: 200.00,
    7200: 250.00
  },
  tickets: {
    5: 1.50,
    12: 3.00,
    22: 5.00,
    50: 10.00,
    110: 20.00,
    300: 50.00,
    650: 100.00,
    1050: 150.00,
    1900: 250.00,
    2400: 300.00
  },
  plans: {
    basic: 0.00,
    pro: 50.00,
    premium: 100.00,
    ultra: 150.00
  },
  promo: {
    active: false,
    type: 'percent',
    value: 0,
    expiresAt: null,
    applyCoins: true,
    applyTickets: true,
    applyPlanBasic: true,
    applyPlanPro: true,
    applyPlanPremium: true,
    applyPlanUltra: true
  }
};

export const getStoreConfig = async (): Promise<StoreConfig> => {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'store_config'));
    if (configDoc.exists()) {
      return { ...DEFAULT_STORE_CONFIG, ...configDoc.data() } as StoreConfig;
    }
  } catch (e) {
    console.warn('Error reading store config from Firestore:', e);
  }
  return DEFAULT_STORE_CONFIG;
};

export const saveStoreConfig = async (config: Partial<StoreConfig>) => {
  await setDoc(doc(db, 'settings', 'store_config'), config, { merge: true });
};

export interface SavedCard {
  id: string;
  last_four: string;
  cardholder_name: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  created_at: string;
}

export const getUserSavedCards = async (userId: string): Promise<SavedCard[]> => {
  try {
    const cardsRef = collection(db, 'users', userId, 'saved_cards');
    const q = query(cardsRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    })) as SavedCard[];
  } catch (e) {
    console.error('Error fetching saved cards:', e);
    return [];
  }
};

export const deleteUserSavedCard = async (userId: string, cardId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'saved_cards', cardId));
};

export const saveUserCard = async (userId: string, card: Omit<SavedCard, 'id' | 'created_at'>) => {
  const cardsRef = collection(db, 'users', userId, 'saved_cards');
  const docRef = await addDoc(cardsRef, {
    ...card,
    created_at: new Date().toISOString()
  });
  return docRef.id;
};

export const calculateItemPrice = (
  type: string,
  credits: string | number,
  config: StoreConfig
) => {
  let originalAmount = 0;
  if (type === 'tickets') originalAmount = config.tickets[String(credits)] || 0;
  else if (type === 'plan') originalAmount = config.plans[String(credits)] || 0;
  else originalAmount = config.coins[String(credits)] || 0;

  let amount = originalAmount;
  let promoDiscountVal = 0;

  if (config.promo && config.promo.active) {
    const now = Date.now();
    const ex = config.promo.expiresAt ? new Date(config.promo.expiresAt).getTime() : Infinity;
    if (now < ex && config.promo.type === 'percent') {
      promoDiscountVal = (config.promo.value || 0) / 100;
      amount = originalAmount * (1 - promoDiscountVal);
    }
  }

  return {
    amount: Math.max(0.5, amount),
    originalAmount
  };
};

export function generateSecurityToken(seed?: string): string {
  const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const p3 = (seed || Date.now().toString(36)).slice(-4).toUpperCase();
  return `AUTH-PIX-${p1}-${p2}-${p3}`;
}

export const checkPendingPixPayment = async (
  userId: string,
  type: string,
  credits: string | number
) => {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/payments/pending-check?type=${type}&credits=${credits}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.isExisting) {
        return {
          id: data.id,
          qrCode: data.qrCode,
          pixCode: data.pixCode,
          isExisting: true,
          expiresIn: data.expiresIn
        };
      }
    }
  } catch (err: any) {
    if (err && !err.message?.includes('Unexpected token') && !err.message?.includes('<!doctype')) {
      console.warn('[Pending Check Notice]', err.message || err);
    }
  }
  return null;
};

export const createPixPayment = async (
  userId: string,
  item: { credits: string | number; type: string; cpf?: string; birthDate?: string; username?: string; email?: string; plan_type?: string }
) => {
  const storeConfig = await getStoreConfig();
  const priceInfo = calculateItemPrice(item.type, item.credits, storeConfig);
  const amount = priceInfo.amount;
  const verificationToken = generateSecurityToken(userId);

  // 1. First attempt calling backend API (works in AI Studio and environments with full-stack server)
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/payments/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...item, verificationToken })
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.id && (data.qrCode || data.pixCode)) {
        return {
          id: data.id,
          qrCode: data.qrCode,
          pixCode: data.pixCode,
          verificationToken: data.verificationToken || verificationToken,
          status: 'pending',
          amount: data.amount || amount,
          isExisting: data.isExisting,
          expiresIn: data.expiresIn
        };
      }
    } else if (!res.ok && contentType.includes('application/json')) {
      const errorData = await res.json();
      if (errorData.error && !errorData.error.includes('Mercado Pago token não foi configurado')) {
        throw new Error(errorData.error);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('<!DOCTYPE') && !err.message.includes('<!doctype') && !err.message.includes('Failed to fetch')) {
      console.warn('[PIX] Backend attempt notice:', err.message);
    }
  }

  // 2. Direct fallback (for Netlify, static hosting, or when backend API is unreachable)
  // Generates official Brazilian Central Bank (BRCode) EMV QR Code and copy-paste code with Firebase sync
  const paymentId = `pix_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanCpf = (item.cpf || '11144477735').replace(/\D/g, '');
  const pixKey = 'sidneyjc05@gmail.com';
  
  let descriptionText = '';
  if (item.type === 'tickets') descriptionText = `${item.credits} Tickets InstaBoost`;
  else if (item.type === 'plan') descriptionText = `Plano ${String(item.credits).toUpperCase()}`;
  else descriptionText = `${item.credits} Moedas InstaBoost`;

  const pixCode = generatePixBrCode({
    key: pixKey,
    name: 'INSTABOOST SOCIAL',
    city: 'SAO PAULO',
    amount: amount,
    txid: paymentId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25),
    description: descriptionText
  });

  const qrCode = await generatePixQrCodeDataUrl(pixCode);

  // Record payment in Firebase Firestore with Security Verification Token
  try {
    await setDoc(doc(db, 'payments', paymentId), {
      id: paymentId,
      userId: userId,
      username: item.username || 'usuario',
      email: item.email || `${userId}@instaboost.com.br`,
      cpf: cleanCpf,
      amount: amount,
      credits: item.type === 'credits' ? Number(item.credits) : 0,
      tickets: item.type === 'tickets' ? Number(item.credits) : 0,
      itemType: item.type,
      planId: item.type === 'plan' ? String(item.credits) : null,
      paymentMethod: 'pix',
      status: 'pending',
      pixCode: pixCode,
      verificationToken: verificationToken,
      delivered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
  } catch (dbErr) {
    console.warn('Firestore payment record notice:', dbErr);
  }

  return {
    id: paymentId,
    qrCode,
    pixCode,
    verificationToken,
    status: 'pending',
    amount
  };
};

export interface SmartQueueStatus {
  position: number;
  totalInQueue: number;
  estimatedSeconds: number;
  status: 'connecting' | 'validating' | 'in_queue' | 'approved' | 'delivered';
}

export const getSmartQueuePosition = async (paymentId: string): Promise<SmartQueueStatus> => {
  try {
    const q = query(
      collection(db, 'payments'),
      where('status', 'in', ['pending', 'in_queue'])
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sort oldest first (FIFO queue)
    docs.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return timeA - timeB;
    });

    const index = docs.findIndex(d => d.id === paymentId);
    const position = index >= 0 ? index + 1 : 1;
    const totalInQueue = Math.max(docs.length, 1);
    const estimatedSeconds = Math.max(3, position * 2);

    return {
      position,
      totalInQueue,
      estimatedSeconds,
      status: 'in_queue'
    };
  } catch (e) {
    return {
      position: 1,
      totalInQueue: 1,
      estimatedSeconds: 3,
      status: 'in_queue'
    };
  }
};

export const verifyAndDeliverPayment = async (
  userId: string,
  paymentId: string,
  verificationToken?: string
) => {
  let serverResult: any = null;
  let serverErrorMsg: string | null = null;

  // 1. Live Server Verification with Mercado Pago API
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ paymentId, verificationToken, userId })
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success && data.status === 'approved') {
        serverResult = data;
      } else if (!res.ok) {
        serverErrorMsg = data.error || 'Pagamento ainda não confirmado pelo banco.';
      }
    }
  } catch (apiErr: any) {
    console.warn('[Backend verification notice]', apiErr?.message);
  }

  // If server confirmed real Mercado Pago approval
  if (serverResult && serverResult.status === 'approved') {
    const creditVal = serverResult.item_type === 'plan' 
      ? serverResult.plan_id 
      : (serverResult.item_type === 'tickets' ? serverResult.tickets : serverResult.credits);
    
    try {
      await deliverPurchase(userId, serverResult.item_type || 'coins', creditVal);
    } catch (e) {}

    return {
      success: true,
      delivered: true,
      message: serverResult.message || 'Pagamento confirmado pelo Mercado Pago e itens liberados com sucesso!',
      itemType: serverResult.item_type || 'coins',
      credits: serverResult.credits || 0,
      tickets: serverResult.tickets || 0,
      planId: serverResult.plan_id,
      amount: serverResult.amount
    };
  }

  // 2. Real-time Firestore Check (in case Mercado Pago Webhook confirmed the payment in Firestore)
  try {
    const payDocRef = doc(db, 'payments', paymentId);
    const payDoc = await getDoc(payDocRef);

    if (payDoc && payDoc.exists()) {
      const payData = payDoc.data();

      // Security check: Must belong to current authenticated user
      if (payData.userId && String(payData.userId) !== String(userId)) {
        throw new Error('Acesso não autorizado para esta transação.');
      }

      // ONLY deliver if the payment status is GENUINELY 'approved' by Mercado Pago / Webhook
      if (payData.status === 'approved') {
        if (!payData.delivered) {
          const creditValue = payData.itemType === 'plan' 
            ? payData.planId 
            : (payData.itemType === 'tickets' ? payData.tickets : (payData.credits || 0));

          await deliverPurchase(userId, payData.itemType || 'coins', creditValue);

          try {
            await updateDoc(payDocRef, {
              delivered: true,
              deliveredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('[Firestore payment doc update warning]', e);
          }
        }

        return {
          success: true,
          delivered: true,
          message: payData.itemType === 'plan'
            ? `Plano ${String(payData.planId).toUpperCase()} ativado com sucesso por 30 dias!`
            : payData.itemType === 'tickets'
            ? `${payData.tickets} Tickets adicionados à sua conta com sucesso!`
            : `${payData.credits} Moedas adicionadas à sua conta com sucesso!`,
          itemType: payData.itemType || 'coins',
          credits: payData.credits || 0,
          tickets: payData.tickets || 0,
          planId: payData.planId,
          amount: payData.amount
        };
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Acesso não autorizado')) {
      throw err;
    }
  }

  // No real payment approval found
  throw new Error(serverErrorMsg || 'Pagamento ainda não confirmado pelo Mercado Pago / Banco Central. Conclua a transferência via PIX no seu banco para aprovação imediata.');
};

export const processCardPayment = async (
  userId: string,
  payload: {
    credits: string | number;
    type: string;
    cardNumber?: string;
    cardholderName?: string;
    expirationMonth?: number;
    expirationYear?: number;
    securityCode?: string;
    savedCardId?: string;
    saveCard?: boolean;
    installments?: number;
    docNumber?: string;
    docType?: string;
    username?: string;
    email?: string;
    plan_type?: string;
  }
) => {
  const storeConfig = await getStoreConfig();
  const priceInfo = calculateItemPrice(payload.type, payload.credits, storeConfig);
  const amount = priceInfo.amount;
  const verificationToken = generateSecurityToken(userId);

  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/payments/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, verificationToken })
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      return { id: data.id, status: data.status, verificationToken };
    }
  } catch (e) {
    console.warn('Card server notice, using direct authorization:', e);
  }

  // Direct approval fallback for test/direct cards
  const paymentId = `pay_card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cardLast4 = (payload.cardNumber || '4242').replace(/\D/g, '').slice(-4) || '4242';

  try {
    await setDoc(doc(db, 'payments', paymentId), {
      id: paymentId,
      userId: userId,
      username: payload.username || 'usuario',
      amount: amount,
      credits: payload.type === 'credits' ? Number(payload.credits) : 0,
      tickets: payload.type === 'tickets' ? Number(payload.credits) : 0,
      itemType: payload.type,
      planId: payload.type === 'plan' ? String(payload.credits) : null,
      paymentMethod: 'credit_card',
      status: 'pending',
      cardLast4: cardLast4,
      verificationToken: verificationToken,
      delivered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    });
  } catch (e) {}

  return { id: paymentId, status: 'pending', verificationToken };
};

export const deliverPurchase = async (
  userId: string,
  type: string,
  credits: string | number
) => {
  const userRef = doc(db, 'users', userId);

  if (type === 'plan') {
    const planName = String(credits).toLowerCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    let bonusCoins = 0;
    if (planName === 'pro') bonusCoins = 1000;
    else if (planName === 'premium') bonusCoins = 2500;
    else if (planName === 'ultra') bonusCoins = 6000;

    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const updateData: any = {
        plan_type: planName,
        plan_expires_at: expiryDate.toISOString()
      };
      if (bonusCoins > 0) {
        updateData.credits = increment(bonusCoins);
      }
      await updateDoc(userRef, updateData);
    }

    await sendNotification(
      userId,
      'Plano VIP Ativado!',
      `Seu plano ${planName.toUpperCase()} foi ativado com sucesso por 30 dias! ${bonusCoins > 0 ? `Bônus de ${bonusCoins} moedas creditado!` : ''}`,
      'store'
    );
  } else if (type === 'tickets') {
    const qty = Number(credits);
    await updateDoc(userRef, {
      tickets: increment(qty)
    });

    await sendNotification(
      userId,
      'Tickets Adicionados!',
      `Você comprou e recebeu ${qty} tickets para a Roleta!`,
      'store'
    );
  } else {
    const qty = Number(credits);
    await updateDoc(userRef, {
      credits: increment(qty)
    });

    await sendNotification(
      userId,
      'Moedas Adicionadas!',
      `Você comprou e recebeu ${qty} moedas na sua conta!`,
      'store'
    );
  }
};
