import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

export const getProbabilitiesForPlan = (planType: string = 'basic') => {
  switch (planType) {
    case 'ultra':
      return [
        { prize: 0.5, prob: 22 },
        { prize: 1, prob: 10 },
        { prize: 5, prob: 12 },
        { prize: 10, prob: 13 },
        { prize: 20, prob: 12 },
        { prize: 50, prob: 10 },
        { prize: 100, prob: 8 },
        { prize: 150, prob: 6 },
        { prize: 200, prob: 4 },
        { prize: 300, prob: 0.5 }
      ];
    case 'premium':
      return [
        { prize: 0.5, prob: 33 },
        { prize: 1, prob: 12 },
        { prize: 5, prob: 13 },
        { prize: 10, prob: 12 },
        { prize: 20, prob: 10 },
        { prize: 50, prob: 7 },
        { prize: 100, prob: 5 },
        { prize: 150, prob: 3 },
        { prize: 200, prob: 2 },
        { prize: 300, prob: 0.2 }
      ];
    case 'pro':
      return [
        { prize: 0.5, prob: 48 },
        { prize: 1, prob: 15 },
        { prize: 5, prob: 12 },
        { prize: 10, prob: 8 },
        { prize: 20, prob: 6 },
        { prize: 50, prob: 4 },
        { prize: 100, prob: 2.5 },
        { prize: 150, prob: 1.2 },
        { prize: 200, prob: 0.3 },
        { prize: 300, prob: 0.05 }
      ];
    case 'basic':
    default:
      return [
        { prize: 0.5, prob: 65 },
        { prize: 1, prob: 18 },
        { prize: 5, prob: 8 },
        { prize: 10, prob: 3.5 },
        { prize: 20, prob: 1.5 },
        { prize: 50, prob: 0.5 },
        { prize: 100, prob: 0.2 },
        { prize: 150, prob: 0.2 },
        { prize: 200, prob: 0.1 },
        { prize: 300, prob: 0.003 }
      ];
  }
};

export const checkRouletteStatus = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) return { canClaim: true, nextClaimTime: null };

  const userData = userDoc.data();
  const lastClaim = userData.last_free_tickets_claim;

  let canClaim = true;
  let nextClaimTime = null;

  if (lastClaim) {
    const claimDate = new Date(lastClaim).getTime();
    const msPassed = Date.now() - claimDate;
    const ms24h = 24 * 60 * 60 * 1000;

    if (msPassed < ms24h) {
      canClaim = false;
      const msLeft = ms24h - msPassed;
      const hrs = Math.floor(msLeft / (1000 * 60 * 60));
      const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
      nextClaimTime = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
    }
  }

  return { canClaim, nextClaimTime };
};

export const claimFreeTickets = async (userId: string, planType: string = 'basic') => {
  const status = await checkRouletteStatus(userId);
  if (!status.canClaim) {
    throw new Error('Esta conta já resgatou tickets nas últimas 24h.');
  }

  let ticketsToGive = 3;
  if (planType === 'pro') ticketsToGive = 6;
  if (planType === 'premium') ticketsToGive = 9;
  if (planType === 'ultra') ticketsToGive = 15;

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    tickets: increment(ticketsToGive),
    last_free_tickets_claim: new Date().toISOString()
  });

  return { success: true, tickets: ticketsToGive };
};

export const spinRoulette = async (userId: string, planType: string = 'basic') => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) throw new Error('Usuário não encontrado');

  const userData = userDoc.data();
  if (!userData.tickets || userData.tickets < 1) {
    throw new Error('Você não tem tickets suficientes.');
  }

  const probabilities = getProbabilitiesForPlan(planType || userData.plan_type || 'basic');
  let totalProb = 0;
  for (const p of probabilities) totalProb += p.prob;
  const rand = Math.random() * totalProb;

  let accumulatedProb = 0;
  let wonPrize = 0.5;
  for (const p of probabilities) {
    accumulatedProb += p.prob;
    if (rand <= accumulatedProb) {
      wonPrize = p.prize;
      break;
    }
  }

  await updateDoc(userRef, {
    tickets: increment(-1),
    credits: increment(wonPrize)
  });

  return { success: true, prize: wonPrize, winAmount: wonPrize };
};
