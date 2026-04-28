import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Lock, CheckCircle, Ticket, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { showNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useAppSound } from '../context/SoundContext';
import confetti from 'canvas-confetti';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
    if (open) {
      fetchRewards();
    }
  }, [open]);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'api/rewards/daily');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      // fail silent
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const deviceHash = localStorage.getItem('device_hash') || btoa(navigator.userAgent).substring(0, 32);
      if (!localStorage.getItem('device_hash')) localStorage.setItem('device_hash', deviceHash);

      const res = await fetch(import.meta.env.BASE_URL + 'api/rewards/daily/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceHash })
      });
      
      const resData = await res.json();
      if (res.ok) {
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
      } else {
        showNotification.error(resData.error || "Erro ao resgatar.");
      }
    } catch {
      showNotification.error("Erro de conexão.");
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
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ y: '100%', opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card w-full max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
          {/* Header */}
          <div className="relative p-6 border-b border-border text-center overflow-hidden rounded-t-3xl">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent"></div>
             <button onClick={onClose} className="absolute z-20 right-4 top-4 p-2 bg-background/50 backdrop-blur-md rounded-full text-muted-foreground hover:text-foreground">
                <X size={20} />
             </button>
             
             <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-200 mb-3">
                   <Calendar className="text-yellow-100" size={32} />
                </div>
                <h2 className="text-2xl font-extrabold text-foreground">Premiação Diária</h2>
                <p className="text-sm text-muted-foreground mt-1 px-8">Entre todos os dias para não perder prêmios acumulativos e tickets surpresa!</p>
             </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {loading || !data ? (
              <div className="flex justify-center p-8">
                 <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                
                <div className="bg-secondary/50 p-4 rounded-xl text-center border border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
                   <p className="text-xs font-semibold text-primary tracking-wider uppercase">Reset Semanal toda Segunda-feira</p>
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
             <div className="p-6 border-t border-border bg-secondary/20 rounded-b-3xl">
                {availableDay ? (
                   <Button 
                      size="lg" 
                      variant="primary" 
                      className="w-full font-bold text-lg h-14 shadow-lg shadow-primary/30"
                      onClick={handleClaim}
                      isLoading={claiming}
                   >
                      RESGATAR PRÊMIO DE HOJE
                   </Button>
                ) : (
                   <div className="w-full text-center py-3 bg-secondary rounded-xl text-muted-foreground font-medium border border-border">
                      {data.plan.every((p:any) => p.state === 'claimed' || p.state === 'missed') && data.plan[6].state !== 'locked' 
                         ? 'Nenhum prêmio restante esta semana.' 
                         : 'Volte amanhã para mais prêmios!'
                      }
                   </div>
                )}
             </div>
          )}
        </motion.div>
      </motion.div>
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

   let bgClass = "bg-card border-border shadow-sm";
   let opacityClass = "";

   if (isClaimed) bgClass = "bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20";
   else if (isMissed) {
      bgClass = "bg-secondary/50 border-transparent grayscale brightness-90";
      opacityClass = "opacity-60";
   }
   else if (isAvailable) {
      bgClass = isSunday ? "bg-gradient-to-b from-yellow-500/20 to-primary/20 border-yellow-500/50 ring-2 ring-yellow-500/50 shadow-md shadow-yellow-500/10" 
                         : "bg-primary/10 border-primary/40 ring-2 ring-primary/40 shadow-md shadow-primary/10";
   }
   else if (isSunday) {
      bgClass = "bg-gradient-to-b from-yellow-500/5 to-transparent border-yellow-500/20";
   }

   return (
      <div className={`relative border rounded-2xl flex flex-col items-center justify-between p-2 pt-3 h-28 overflow-hidden transition-all ${bgClass} ${opacityClass}`}>
         
         {/* Status Icon */}
         {isClaimed && <div className="absolute top-1 right-1 text-green-500 bg-background rounded-full"><CheckCircle size={14} fill="currentColor" className="text-green-500 mix-blend-screen" /></div>}
         {isLocked && <div className="absolute top-1.5 right-1.5 text-muted-foreground/30"><Lock size={12} /></div>}
         {isMissed && <div className="absolute top-1.5 right-1.5 text-red-500/50"><X size={12} /></div>}

         <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isSunday && !isMissed ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {getDayName(day.dayIndex)}
         </span>

         <div className="flex-1 flex flex-col items-center justify-center w-full gap-1">
            <div className="flex items-center gap-1 font-bold text-sm">
               {day.coins} <span className="text-[10px]">💰</span>
            </div>
            {day.tickets > 0 && (
               <div className="flex items-center gap-1 font-bold text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20 whitespace-nowrap">
                  +{day.tickets} 🎟️
               </div>
            )}
         </div>

         {isAvailable && (
            <div className={`absolute bottom-0 left-0 w-full text-center text-[9px] py-1 font-bold ${isSunday ? 'bg-yellow-500 text-yellow-950' : 'bg-primary text-primary-foreground'}`}>
               HOJE
            </div>
         )}
      </div>
   );
}
