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
      const res = await fetch('/api/rewards/daily');
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

      const res = await fetch('/api/rewards/daily/claim', {
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
            className="bg-card w-full max-w-lg md:rounded-3xl md:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] border border-border/50 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
          {/* Header */}
          <div className="relative p-6 md:p-8 text-center overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent"></div>
             <button onClick={onClose} className="absolute z-20 right-6 top-6 p-2 bg-secondary/80 backdrop-blur-md rounded-full text-muted-foreground hover:text-foreground hover:scale-110 transition-transform">
                <X size={20} />
             </button>
             
             <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-[1.5rem] flex items-center justify-center shadow-xl border-4 border-yellow-200/50 mb-4 rotate-3 group-hover:rotate-0 transition-transform">
                   <Calendar className="text-yellow-50" size={40} />
                </div>
                <h2 className="text-3xl font-black text-foreground tracking-tight">Prêmio Diário</h2>
                <p className="text-sm text-muted-foreground mt-2 px-10 leading-relaxed">Retorne todos os dias para desbloquear prêmios épicos e tickets raros!</p>
             </div>
          </div>

          {/* Content */}
          <div className="p-8 pt-0 overflow-y-auto flex-1 custom-scrollbar">
            {loading || !data ? (
              <div className="flex flex-col items-center justify-center p-12 gap-3">
                 <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                 <span className="text-xs font-bold text-muted-foreground animate-pulse">CARREGANDO...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                <div className="bg-primary/5 p-4 rounded-2xl text-center border border-primary/10 relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 animate-pulse"></div>
                   <p className="relative z-10 text-[10px] font-black text-primary tracking-[0.2em] uppercase">Progresso Semanal</p>
                </div>

                <div className="grid grid-cols-4 gap-3">
                   {data.plan.slice(0, 4).map((day: any) => (
                      <RewardDayCard key={day.dayIndex} day={day} getDayName={getDayName} />
                   ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                   {data.plan.slice(4, 7).map((day: any) => (
                      <RewardDayCard key={day.dayIndex} day={day} getDayName={getDayName} />
                   ))}
                </div>
                
              </div>
            )}
          </div>

          {/* Footer Action */}
          {!loading && data && (
             <div className="p-8 pt-4 bg-secondary/10 border-t border-border/50">
                {availableDay ? (
                   <Button 
                      size="lg" 
                      variant="primary" 
                      className="w-full font-black text-lg h-16 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform"
                      onClick={handleClaim}
                      isLoading={claiming}
                   >
                      <Ticket size={20} className="mr-2" /> RESGATAR RECOMPENSA
                   </Button>
                ) : (
                   <div className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-secondary/50 rounded-2xl text-muted-foreground font-bold border border-border/50 text-sm italic">
                      <Zap size={16} className="text-yellow-500 fill-current" />
                      Próximo prêmio disponível em breve!
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
