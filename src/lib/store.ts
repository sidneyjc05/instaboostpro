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
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { sendNotification } from './notifications';

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

export const createPixPayment = async (
  userId: string,
  item: { credits: string | number; type: string }
) => {
  const config = await getStoreConfig();
  const { amount } = calculateItemPrice(item.type, item.credits, config);

  const fakePixCode = `00020126580014br.gov.bcb.pix0136${Math.random().toString(36).substring(2, 15)}520400005303986540${amount.toFixed(2)}5802BR5925FIRECROWD PROMOTIONS6009SAO PAULO62070503***6304`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fakePixCode)}`;

  const paymentDoc = await addDoc(collection(db, 'payments'), {
    user_id: userId,
    type: item.type,
    credits: item.credits,
    amount,
    method: 'pix',
    status: 'approved', // Instant simulated approval for seamless testing / real Firestore sync
    pix_code: fakePixCode,
    qr_code: qrCodeUrl,
    created_at: new Date().toISOString()
  });

  // Apply delivery immediately
  await deliverPurchase(userId, item.type, item.credits);

  return {
    id: paymentDoc.id,
    qrCode: qrCodeUrl,
    pixCode: fakePixCode,
    status: 'approved',
    amount
  };
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
  }
) => {
  const config = await getStoreConfig();
  const { amount } = calculateItemPrice(payload.type, payload.credits, config);

  let lastFour = '4242';
  let brand = 'visa';

  if (payload.savedCardId && payload.savedCardId !== 'new') {
    const cardDoc = await getDoc(doc(db, 'users', userId, 'saved_cards', payload.savedCardId));
    if (cardDoc.exists()) {
      const cdata = cardDoc.data();
      lastFour = cdata.last_four || '4242';
      brand = cdata.brand || 'visa';
    }
  } else if (payload.cardNumber) {
    lastFour = payload.cardNumber.slice(-4);
    if (payload.cardNumber.startsWith('5')) brand = 'mastercard';
    else if (payload.cardNumber.startsWith('4')) brand = 'visa';
    else if (payload.cardNumber.startsWith('3')) brand = 'amex';
    else if (payload.cardNumber.startsWith('6')) brand = 'elo';

    if (payload.saveCard) {
      await saveUserCard(userId, {
        last_four: lastFour,
        brand,
        cardholder_name: payload.cardholderName || 'TITULAR',
        exp_month: payload.expirationMonth || 12,
        exp_year: payload.expirationYear || 2028
      });
    }
  }

  // Record payment in Firestore
  const paymentDoc = await addDoc(collection(db, 'payments'), {
    user_id: userId,
    type: payload.type,
    credits: payload.credits,
    amount,
    method: 'credit_card',
    installments: payload.installments || 1,
    status: 'approved',
    card_last_four: lastFour,
    card_brand: brand,
    created_at: new Date().toISOString()
  });

  // Apply delivery
  await deliverPurchase(userId, payload.type, payload.credits);

  return {
    id: paymentDoc.id,
    status: 'approved',
    amount,
    paymentMethod: 'credit_card'
  };
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

    await updateDoc(userRef, {
      plan_type: planName,
      plan_expires_at: expiryDate.toISOString()
    });

    await sendNotification(
      userId,
      'Plano VIP Ativado!',
      `Seu plano ${planName.toUpperCase()} foi ativado com sucesso por 30 dias!`,
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
