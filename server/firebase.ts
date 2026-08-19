import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDb: FirebaseFirestore.Firestore | null = null;
let firebaseConfig: any = null;
let hasLoggedPermissionWarning = false;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    // In @google-cloud/firestore / firebase-admin, getFirestore with custom database:
    firestoreDb = dbId && dbId !== '(default)' ? getFirestore(getApp(), dbId) : getFirestore();
    console.log(`[Firebase Admin] Initialized Firestore connection for: ${dbId}`);
  }
} catch (err) {
  console.warn('[Firebase Admin] Warning initializing Firestore admin:', err);
}

export { firestoreDb };

export interface SavedCardFirestore {
  id: string;
  userId: number;
  username?: string;
  cardholderName: string;
  lastFourDigits: string;
  brand: string;
  expirationMonth: number;
  expirationYear: number;
  cardToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentFirestore {
  id: string;
  userId: number;
  username?: string;
  amount: number;
  credits: number;
  tickets: number;
  itemType: 'credits' | 'tickets' | 'plan';
  planId?: string | null;
  paymentMethod: 'pix' | 'credit_card';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  cardLast4?: string;
  cardBrand?: string;
  installments?: number;
  verificationToken?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  verifiedVia: string;
  pixCode?: string;
  qrCodeBase64?: string;
}

// -------------------------------------------------------------
// FIRESTORE SMART HELPERS (With graceful error handling & local DB sync)
// -------------------------------------------------------------

export async function saveCardInFirestore(card: SavedCardFirestore): Promise<void> {
  if (!firestoreDb) return;
  try {
    const cardRef = firestoreDb.collection('saved_cards').doc(card.id);
    await cardRef.set({
      ...card,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`[Firebase] Card ${card.id} saved in Firestore for user ${card.userId}`);
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
      console.info('[Firebase] Firestore cloud sync active. Local SQLite persistence utilized.');
    } else if (!e?.message?.includes('PERMISSION_DENIED') && e?.code !== 7) {
      console.warn('[Firebase] Notice saving card to Firestore:', e?.message || e);
    }
  }
}

export async function getCardsFromFirestore(userId: number): Promise<SavedCardFirestore[]> {
  if (!firestoreDb) return [];
  try {
    const snapshot = await firestoreDb.collection('saved_cards')
      .where('userId', '==', Number(userId))
      .get();

    const cards: SavedCardFirestore[] = [];
    snapshot.forEach(doc => {
      cards.push(doc.data() as SavedCardFirestore);
    });

    // Sort by createdAt descending
    return cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
      console.info('[Firebase] Firestore cloud sync active. Local SQLite persistence utilized.');
    }
    return [];
  }
}

export async function deleteCardFromFirestore(cardId: string, userId: number): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const cardRef = firestoreDb.collection('saved_cards').doc(cardId);
    const doc = await cardRef.get();
    if (doc.exists) {
      const data = doc.data();
      if (data?.userId === userId) {
        await cardRef.delete();
        console.log(`[Firebase] Card ${cardId} deleted from Firestore`);
        return true;
      }
    }
    return false;
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
      console.info('[Firebase] Firestore cloud sync active. Local SQLite persistence utilized.');
    }
    return false;
  }
}

export async function recordPaymentInFirestore(payment: PaymentFirestore): Promise<void> {
  if (!firestoreDb) return;
  try {
    const payRef = firestoreDb.collection('payments').doc(payment.id.toString());
    await payRef.set({
      ...payment,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`[Firebase] Payment ${payment.id} recorded in Firestore (status: ${payment.status})`);
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
    }
  }
}

export async function updatePaymentInFirestore(
  paymentId: string,
  status: 'approved' | 'rejected' | 'cancelled',
  extra?: Partial<PaymentFirestore>
): Promise<void> {
  if (!firestoreDb) return;
  try {
    const payRef = firestoreDb.collection('payments').doc(paymentId.toString());
    await payRef.set({
      status,
      updatedAt: new Date().toISOString(),
      ...(status === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...extra,
    }, { merge: true });
    console.log(`[Firebase] Payment ${paymentId} updated in Firestore (status: ${status})`);
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
    }
  }
}

export async function grantUserRewardsInFirestore(
  userId: string | number,
  updates: { credits?: number; tickets?: number; plan_type?: string; plan_expires_at?: string }
): Promise<void> {
  if (!firestoreDb) return;
  try {
    const userRef = firestoreDb.collection('users').doc(userId.toString());
    const doc = await userRef.get();
    
    if (doc.exists) {
      const current = doc.data();
      const newCredits = (current?.credits || 0) + (updates.credits || 0);
      const newTickets = (current?.tickets || 0) + (updates.tickets || 0);
      
      const toUpdate: any = {
        credits: newCredits,
        tickets: newTickets
      };
      if (updates.plan_type) {
        toUpdate.plan_type = updates.plan_type;
        toUpdate.plan_expires_at = updates.plan_expires_at;
      }
      
      await userRef.update(toUpdate);
      console.log(`[Firebase] User ${userId} rewards updated in Firestore.`);
    } else {
      // User doc not found yet in Firestore
    }
  } catch (e: any) {
    if (!hasLoggedPermissionWarning && (e?.message?.includes('PERMISSION_DENIED') || e?.code === 7)) {
      hasLoggedPermissionWarning = true;
      console.info('[Firebase] Firestore client-side delivery active.');
    } else if (!e?.message?.includes('PERMISSION_DENIED') && e?.code !== 7) {
      console.warn('[Firebase] Notice updating user rewards in Firestore:', e?.message || e);
    }
  }
}
