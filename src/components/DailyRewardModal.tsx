import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Lock, CheckCircle, Ticket, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { showNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useAppSound } from '../context/SoundContext';
import confetti from 'canvas-confetti';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AnimatedIcon } from './AnimatedIcon';
import { fetchDailyRewards, claimDailyReward } from '../lib/dailyRewards';

interface DailyRewardModalProps {
  open: boolean;
  onClose: () => void;
}

export function DailyRewardModal({ open, onClose }: DailyRewardModalProps) {
  const { user, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [data, setData] = useState<any>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (open && user) {
      fetchRewards();
    }
  }, [open, user]);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      if (user) {
        const rewards = await fetchDailyRewards(user.id, user.plan_type);
        setData(rewards);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);
    try {
      const resData = await claimDailyReward(user.id, user.plan_type);
      playSuccess();
      confetti({
         particleCount: 100,
         spread: 70,
         origin: { y: 0.6 },
         colors: ['#eab308', '#8b5cf6', '#3b82f6'] // yellow, purple, blue
      });
      showNotification.success(`Prêmio Diário Resgatado! +${resData.reward.coins} moedas${resData.reward.tickets > 0 ? ` e +${resData.reward.tickets} Tickets` : ''}!`);
      await refreshUser();
      await fetchRewards();
    } catch (err: any) {
      showNotification.error(err.message || "Erro ao resgatar.");
    } finally {
      setClaiming(false);
    }
  };

  const getDayName = (index: number) => {
     const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
     return days[index - 1] || 'Dia';
  };

  const availableDay = data?.plan?.find((p: any) => p.state === 'available');

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden flex items-end justify-center md:items-center p-0 md:p-4 custom-scrollbar">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: '100%', opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-[#0c0d14] border border-white/10 w-full max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] my-auto overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
          {/* Header */}
          <div className="relative p-4 md:p-6 border-b border-white/10 bg-[#0f101a] text-center overflow-hidden rounded-t-3xl shrink-0">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-purple-500/10 to-transparent"></div>
             <button onClick={onClose} className="absolute z-20 right-4 top-4 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
             </button>
             
             <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-200 mb-2 md:mb-3">
                   <Calendar size={24} className="text-yellow-100 md:w-8 md:h-8" />
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-foreground leading-tight">Premiação Diária</h2>
                <p className="text-[10px] md:text-sm text-muted-foreground mt-1 px-4 md:px-8">Prêmios acumulativos e tickets surpresa!</p>
             </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar min-h-0 bg-[#0c0d14]">
            {loading || !data ? (
              <div className="flex justify-center p-8">
                 <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:gap-4">
                
                <div className="bg-[#141522] p-2 md:p-4 rounded-xl text-center border border-primary/30 bg-gradient-to-r from-primary/10 via-[#141522] to-primary/10">
                   <p className="text-[10px] md:text-xs font-bold text-primary tracking-wider uppercase">Reset Semanal toda Segunda-feira</p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                   {data.plan.slice(0, 4).map((day: any) => (
                      <RewardDayCard key={day.dayIndex} day={day} getDayName={getDayName} />
                   ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                   {data.plan.slice(4, 7).map((day: any) => (
                      <RewardDayCard key={day.dayIndex} day={day} getDayName={getDayName} />
                   ))}
                </div>
                
              </div>
            )}
          </div>

          {/* Footer Action */}
          {!loading && data && (
             <div className="p-4 md:p-6 border-t border-white/10 bg-[#0f101a] rounded-b-3xl shrink-0">
                {availableDay ? (
                   <Button 
                      size="lg" 
                      variant="primary" 
                      className="w-full font-bold text-base md:text-lg h-12 md:h-14 shadow-lg shadow-primary/30"
                      onClick={handleClaim}
                      isLoading={claiming}
                   >
                      RESGATAR PRÊMIO DE HOJE
                   </Button>
                ) : (
                   <div className="w-full text-center py-3 bg-[#141522] rounded-xl text-muted-foreground font-medium border border-white/10 text-sm">
                      {data.plan.every((p:any) => p.state === 'claimed' || p.state === 'missed') && data.plan[6].state !== 'locked' 
                         ? 'Nenhum prêmio restante esta semana.' 
                         : 'Volte amanhã para mais prêmios!'
                      }
                   </div>
                )}
             </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}

interface RewardDayCardProps {
  key?: React.Key;
  day: any;
  getDayName: (idx: number) => string;
}

function RewardDayCard({ day, getDayName }: RewardDayCardProps) {
   const isAvailable = day.state === 'available';
   const isClaimed = day.state === 'claimed';
   const isMissed = day.state === 'missed';
   const isLocked = day.state === 'locked';
   
   // Special styling for Sunday (day 7)
   const isSunday = day.dayIndex === 7;

   let bgClass = "bg-[#151624] border-white/10 shadow-sm";
   let opacityClass = "";

   if (isClaimed) bgClass = "bg-[#0c2317] border-emerald-500/40 ring-1 ring-emerald-500/30 text-emerald-300";
   else if (isMissed) {
      bgClass = "bg-[#11121c] border-white/5 grayscale brightness-75";
      opacityClass = "opacity-60";
   }
   else if (isAvailable) {
      bgClass = isSunday ? "bg-gradient-to-b from-amber-500/30 via-[#231d10] to-[#171424] border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20" 
                         : "bg-gradient-to-b from-primary/30 via-[#1f1530] to-[#151624] border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/20";
   }
   else if (isSunday) {
      bgClass = "bg-[#1b1726] border-yellow-500/30";
   }

   return (
      <div className={`relative border rounded-xl md:rounded-2xl flex flex-col items-center justify-between p-1.5 md:p-2 pt-2 md:pt-3 h-20 md:h-28 overflow-hidden transition-all ${bgClass} ${opacityClass}`}>
         
         {/* Status Icon */}
         {isClaimed && <div className="absolute top-1 right-1 text-green-500 bg-background rounded-full"><CheckCircle size={12} fill="currentColor" className="text-green-500 mix-blend-screen md:w-3.5 md:h-3.5" /></div>}
         {isLocked && <div className="absolute top-1 right-1 text-muted-foreground/30"><Lock size={10} className="md:w-3" /></div>}
         {isMissed && <div className="absolute top-1 right-1 text-red-500/50"><X size={10} className="md:w-3" /></div>}

         <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider mb-0.5 md:mb-1 ${isSunday && !isMissed ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {getDayName(day.dayIndex)}
         </span>

         <div className="flex-1 flex flex-col items-center justify-center w-full gap-0.5 md:gap-1">
            <div className="flex items-center gap-0.5 md:gap-1 font-bold text-xs md:text-sm">
               {day.coins} <AnimatedIcon type="coin" size={10} className="md:w-3 md:h-3 ml-0.5" />
            </div>
            {day.tickets > 0 && (
               <div className="flex items-center gap-0.5 md:gap-1 font-bold text-[8px] md:text-[11px] text-primary bg-primary/10 px-1 md:px-1.5 py-0.5 rounded-md border border-primary/20 whitespace-nowrap">
                  +{day.tickets} <AnimatedIcon type="ticket" size={10} className="md:w-3.5 md:h-3.5 ml-0.5" />
               </div>
            )}
         </div>

         {isAvailable && (
            <div className={`absolute bottom-0 left-0 w-full text-center text-[7px] md:text-[9px] py-0.5 md:py-1 font-bold ${isSunday ? 'bg-yellow-500 text-yellow-950' : 'bg-primary text-primary-foreground'}`}>
               HOJE
            </div>
         )}
      </div>
   );
}
