import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

export const getUTCDateString = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export const getWeekStart = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); 
  d.setUTCDate(diff);
  return d;
};

export const fetchDailyRewards = async (userId: string, planType: string = 'basic') => {
  const now = new Date();
  const todayStr = getUTCDateString(now);
  const weekStart = getWeekStart(now);
  const weekStartStr = getUTCDateString(weekStart);

  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) throw new Error('User not found');
  
  const userData = userDoc.data();
  let planJson = userData.weekly_reward_plan;
  const currentWeekStart = userData.weekly_reward_week_start;

  if (currentWeekStart !== weekStartStr || !planJson) {
    const baseRanges = [
        { min: 0.2, max: 2, tChance: 0.10 },
        { min: 0.5, max: 5, tChance: 0.15 },
        { min: 1, max: 10, tChance: 0.20 },
        { min: 2, max: 20, tChance: 0.10 },
        { min: 5, max: 40, tChance: 0.15 },
        { min: 10, max: 80, tChance: 0.10 },
        { min: 20, max: 200, tChance: 0.30 },
    ];
    let ticketsGiven = 0;
    const plan = baseRanges.map((range, index) => {
        let rawCoins = (Math.random() * (range.max - range.min) + range.min);
        if (index === 6) {
            const rareChance = Math.random();
            if (rareChance < 0.01) rawCoins = 3000;
            else if (rareChance < 0.05) rawCoins = 500;
        }
        const coins = parseFloat(rawCoins.toFixed(1));
        let tickets = 0;
        if (ticketsGiven < 2 && Math.random() < range.tChance) { 
             tickets = Math.floor(Math.random() * 4) + 2;  
             ticketsGiven++;
        }
        return { dayIndex: index + 1, coins, tickets };
    });
    
    planJson = JSON.stringify(plan);
    await updateDoc(userRef, {
      weekly_reward_plan: planJson,
      weekly_reward_week_start: weekStartStr,
      weekly_claims: [] // reset weekly claims
    });
  }

  const plan = JSON.parse(planJson);
  const claimedDates = new Set(userData.weekly_claims || []);
  const todayIndex = now.getUTCDay() === 0 ? 7 : now.getUTCDay();

  let planMultiplierValue = 1;
  if (planType === 'pro') planMultiplierValue = 2;
  if (planType === 'premium') planMultiplierValue = 5;
  if (planType === 'ultra') planMultiplierValue = 15;

  const mappedPlan = plan.map((p: any) => {
      const dateObj = new Date(weekStart);
      dateObj.setUTCDate(dateObj.getUTCDate() + p.dayIndex - 1);
      const dayDateStr = getUTCDateString(dateObj);
      
      let state = 'locked';
      if (claimedDates.has(dayDateStr)) { 
           state = 'claimed';
      } else if (dayDateStr === todayStr) { 
           state = 'available';
      } else if (p.dayIndex < todayIndex) { 
           state = 'missed';
      }
      
      let scaledCoins = p.coins;
      if (planMultiplierValue > 1) { 
           scaledCoins = p.coins * planMultiplierValue;
           if (scaledCoins > 3000) scaledCoins = 3000;
           scaledCoins = parseFloat(scaledCoins.toFixed(1));
      }
      return { ...p, coins: scaledCoins, date: dayDateStr, state };
  });

  return { todayStr, weekStartStr, plan: mappedPlan };
};

export const claimDailyReward = async (userId: string, planType: string = 'basic') => {
  const { plan, todayStr } = await fetchDailyRewards(userId, planType);
  const todayReward = plan.find((p: any) => p.date === todayStr && p.state === 'available');
  
  if (!todayReward) {
    throw new Error('Nenhum prêmio disponível hoje ou já resgatado.');
  }

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    credits: increment(todayReward.coins),
    tickets: increment(todayReward.tickets || 0),
    weekly_claims: arrayUnion(todayStr),
    last_daily_claim: todayStr
  });

  return { reward: todayReward };
};
