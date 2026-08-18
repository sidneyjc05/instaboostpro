import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { deliverPurchase } from '../lib/store';
import { showNotification } from '../context/NotificationContext';
import confetti from 'canvas-confetti';

export function usePaymentDeliveryQueue() {
  const { user, refreshUser } = useAuth();
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    // Listen to current user's payments in real-time
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const docChange of snapshot.docChanges()) {
        if (docChange.type === 'added' || docChange.type === 'modified') {
          const data = docChange.doc.data();
          const paymentId = docChange.doc.id;

          // Check if payment is approved but not delivered yet
          if (data.status === 'approved' && data.delivered !== true && !processingRef.current.has(paymentId)) {
            processingRef.current.add(paymentId);

            try {
              const creditValue = data.itemType === 'plan' 
                ? data.planId 
                : (data.itemType === 'tickets' ? data.tickets : data.credits);

              await deliverPurchase(user.id, data.itemType, creditValue);

              await updateDoc(doc(db, 'payments', paymentId), {
                delivered: true,
                deliveredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              await refreshUser();

              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
              });

              showNotification.success(
                data.itemType === 'plan'
                  ? `Seu Plano ${String(data.planId).toUpperCase()} foi liberado com sucesso!`
                  : `Seus ${data.itemType === 'tickets' ? `${data.tickets} tickets` : `${data.credits} moedas`} foram liberados na sua conta!`
              );
            } catch (err) {
              console.error('Error auto-delivering queued payment:', err);
            } finally {
              processingRef.current.delete(paymentId);
            }
          }
        }
      }
    }, (err) => {
      console.warn('Payment delivery queue listener notice:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);
}
