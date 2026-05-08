import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Target, Ticket, Zap, Trophy, Coins } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { useAppSound } from '../context/SoundContext';
import { AnimatedIcon } from '../components/AnimatedIcon';

// Definition of the wheel sections matching the user's requirements
const PRIZES = [
  { value: 0.5, label: "0.5 Moeda", color: "#64748b", probability: 65, gradient: "from-slate-500 to-slate-600" },
  { value: 1,   label: "1 Moeda",   color: "#3b82f6", probability: 18, gradient: "from-blue-500 to-blue-600" },
  { value: 5,   label: "5 Moedas",  color: "#10b981", probability: 8,  gradient: "from-emerald-500 to-emerald-600" },
  { value: 10,  label: "10 Moedas", color: "#8b5cf6", probability: 3.5,gradient: "from-violet-500 to-violet-600" },
  { value: 20,  label: "20 Moedas", color: "#f59e0b", probability: 1.5,gradient: "from-amber-500 to-amber-600" },
  { value: 50,  label: "50 Moedas", color: "#f97316", probability: 0.5,gradient: "from-orange-500 to-orange-600" },
  { value: 100, label: "100 Moedas",color: "#ef4444", probability: 0.2,gradient: "from-red-500 to-red-600" },
  { value: 150, label: "150 Moedas",color: "#ec4899", probability: 0.2,gradient: "from-pink-500 to-pink-600" },
  { value: 200, label: "200 Moedas",color: "#06b6d4", probability: 0.1,gradient: "from-cyan-500 to-cyan-600" },
  { value: 300, label: "300 Moedas", color: "#eab308", probability: 0.003, gradient: "from-yellow-400 to-yellow-600" },
];

export default function Roulette() {
  const { user, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  
  const [spinning, setSpinning] = useState(false);
  const rotationValue = useMotionValue(0);
  const [prizeWin, setPrizeWin] = useState<any>(null);
  const [winInfo, setWinInfo] = useState<{ winAmount: number } | null>(null);

  const lastTickAngle = useRef(0);

  const [canClaimFree, setCanClaimFree] = useState(false);
  const [nextFreeClaim, setNextFreeClaim] = useState<string | null>(null);

  const [claimingFree, setClaimingFree] = useState(false);

  const checkFreeStatus = async () => {
    try {
      const res = await fetch('/api/roulette/status');
      if (res.ok) {
        const data = await res.json();
        setCanClaimFree(data.canClaim);
        setNextFreeClaim(data.nextClaimTime);
      }
    } catch {}
  };

  useEffect(() => {
    checkFreeStatus();
  }, []);

  const claimFreeTickets = async () => {
    setClaimingFree(true);
    try {
      const deviceHash = localStorage.getItem('device_hash') || btoa(navigator.userAgent).substring(0, 32);
      if (!localStorage.getItem('device_hash')) localStorage.setItem('device_hash', deviceHash);

      const res = await fetch('/api/roulette/claim', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ deviceHash })
      });
      const data = await res.json();
      if (res.ok) {
         playSuccess();
         showNotification.success('Você ganhou 3 Tickets Grátis!');
         await refreshUser();
         checkFreeStatus();
      } else {
         showNotification.error(data.error || 'Erro ao resgatar');
      }
    } catch {
      showNotification.error('Erro de conexão ao resgatar tickets.');
    } finally {
      setClaimingFree(false);
    }
  };

  const spinRoulette = async () => {
    if (spinning) return;
    if (!user?.tickets || user.tickets < 1) {
       showNotification.error("Você não tem tickets suficientes. Resgate no Prêmio Diário ou compre na Loja.");
       return;
    }

    setSpinning(true);
    setPrizeWin(null);
    setWinInfo(null);
    lastTickAngle.current = 0;

    try {
       const res = await fetch('/api/roulette/spin', { method: 'POST' });
       const data = await res.json();
       
       if (!res.ok) {
          showNotification.error(data.error || "Erro ao girar.");
          setSpinning(false);
          return;
       }

       const winIndex = PRIZES.findIndex(p => p.value === data.prize);
       if (winIndex === -1) {
          setSpinning(false);
          return;
       }

       // Calculate rotation to stop at the specific slice
       const numSlices = PRIZES.length;
       const sliceAngle = 360 / numSlices;
       const randomOffset = Math.floor(Math.random() * (sliceAngle - 10)) + 5; 
       
       const sliceStartAngle = winIndex * sliceAngle;
       const targetAngle = 360 - (sliceStartAngle + randomOffset);
       const currentRotation = rotationValue.get();
       const fullRotations = 8 * 360; 
       const finalRotation = currentRotation + fullRotations + (360 - (currentRotation % 360)) + targetAngle;

       animate(rotationValue, finalRotation, {
          duration: 5,
          ease: [0.1, 0.7, 0.1, 1], // Custom cubic-bezier
          onUpdate: (latest) => {
             const anglePerTick = sliceAngle;
             const diff = latest - lastTickAngle.current;
             if (diff >= anglePerTick) {
                playClick();
                lastTickAngle.current = latest;
             }
          },
          onComplete: async () => {
             setSpinning(false);
             setPrizeWin(PRIZES[winIndex]);
             setWinInfo({ 
                 winAmount: data.winAmount
             });
             playSuccess();
             await refreshUser();
          }
       });
       
    } catch {
       showNotification.error("Falha ao girar a roleta");
       setSpinning(false);
    }
  };

  // Helper to draw wheel slice
  const createConicGradient = () => {
     let gradient = [];
     const sliceSize = 100 / PRIZES.length;
     for (let i = 0; i < PRIZES.length; i++) {
        gradient.push(`${PRIZES[i].color} ${i * sliceSize}% ${(i + 1) * sliceSize}%`);
     }
     return `conic-gradient(${gradient.join(', ')})`;
  };

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-2xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Target className="text-primary" /> Roleta da Sorte
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Use seus Tickets e ganhe sempre prêmios em Moedas!
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-secondary/50 border border-border rounded-3xl p-4 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Meus Tickets</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-center gap-2">
               {user?.tickets ?? 0} <AnimatedIcon type="ticket" size={20} className="ml-1" />
            </span>
        </div>
        <div className="flex-1 bg-secondary/50 border border-border rounded-3xl p-4 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Minhas Moedas</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-yellow-500 flex items-center gap-2">
               {(user?.credits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <AnimatedIcon type="coin" size={20} className="ml-1" />
            </span>
        </div>
      </div>

      {/* ROULETTE UI */}
      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
         <div className="relative w-64 h-64 md:w-80 md:h-80 select-none">
            {/* Outer border/ring */}
            <div className="absolute inset-[-12px] rounded-full border-8 border-foreground/5 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]" />
            
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -ml-4 -mt-6 z-30 filter drop-shadow-lg">
                <div className="w-8 h-10 bg-foreground rounded-full flex items-center justify-center">
                    <div className="w-1 h-6 bg-primary rounded-full mt-2 animate-pulse" />
                </div>
            </div>
            
            {/* Wheel */}
            <motion.div 
               className="w-full h-full rounded-full border-8 border-foreground shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden relative"
               style={{ 
                  background: createConicGradient(),
                  rotate: rotationValue
               }}
            >
               {/* Labels manually mapped for safety and beauty */}
               {PRIZES.map((prize, i) => {
                  const numSlices = PRIZES.length;
                  const sliceAngle = 360 / numSlices;
                  const rotateDeg = (i * sliceAngle) + (sliceAngle / 2);
                  return (
                     <div 
                        key={i}
                        className="absolute top-0 left-1/2 w-12 h-[50%] -ml-6 origin-bottom flex items-start justify-center pt-3"
                        style={{ transform: `rotate(${rotateDeg}deg)` }}
                     >
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-white text-[9px] md:text-[11px] font-black uppercase tracking-tighter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] [writing-mode:vertical-rl]">
                              {prize.label}
                           </span>
                           {prize.value === 300 && <Zap size={14} className="text-yellow-300 fill-yellow-300" />}
                        </div>
                     </div>
                  );
               })}

               {/* Inner decorative highlights */}
               <div className="absolute inset-0 rounded-full border-[1.5px] border-white/20 pointer-events-none" />
            </motion.div>
            
            {/* Center Peg */}
            <div className="absolute top-1/2 left-1/2 w-14 h-14 bg-foreground rounded-full -ml-7 -mt-7 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 flex items-center justify-center border-4 border-primary">
               <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary to-primary-foreground/20 flex items-center justify-center">
                  <Coins size={20} className="text-white" />
               </div>
            </div>
         </div>

         <div className="mt-12 flex flex-col items-center gap-4 w-full px-4">
            <Button 
               size="lg" 
               variant="primary" 
               className="w-full h-16 text-xl font-black rounded-2xl shadow-xl shadow-primary/20 relative group overflow-hidden" 
               onClick={spinRoulette}
               disabled={spinning}
            >
               <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
               {spinning ? (
                  <span className="flex items-center gap-3">
                     <Zap className="animate-bounce" /> Girando...
                  </span>
               ) : (
                  <span className="flex items-center justify-center gap-3">
                     GIRAR AGORA <span className="bg-black/20 px-3 py-1 rounded-lg flex items-center gap-1.5 text-base">-1 <AnimatedIcon type="ticket" size={18} /></span>
                  </span>
               )}
            </Button>
            
            {!spinning && (
               <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-muted-foreground text-xs flex items-center gap-1 bg-secondary/30 px-4 py-2 rounded-full"
               >
                  <Trophy size={14} className="text-yellow-500" /> Tente a sorte no <b>PRÊMIO 300 MOEDAS</b> (Aumente suas chances sendo VIP!)
               </motion.div>
            )}
         </div>
      </div>

      <AnimatePresence>
         {prizeWin && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.8, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.8 }}
               className={`
                  relative overflow-hidden border-2 rounded-[2.5rem] p-8 flex flex-col items-center gap-4 text-center shadow-2xl
                  ${winInfo?.winAmount === 300 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-300' : 'bg-gradient-to-br from-indigo-500 to-blue-700 border-blue-400/30'}
               `}
            >
               {/* Decorative floating particles */}
               <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                     <div 
                        key={i} 
                        className="absolute bg-white/40 rounded-full animate-float"
                        style={{
                           width: Math.random() * 20 + 5 + 'px',
                           height: Math.random() * 20 + 5 + 'px',
                           top: Math.random() * 100 + '%',
                           left: Math.random() * 100 + '%',
                           animationDelay: i * 0.5 + 's'
                        }}
                     />
                  ))}
               </div>

               <div className="relative z-10">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transform rotate-12 shadow-inner bg-white/20 backdrop-blur-sm border border-white/30`}>
                     <Trophy size={40} className="text-white fill-white" />
                  </div>
                  
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-1">
                     INCRÍVEL! VOCÊ GANHOU!
                  </h3>

                  <div className={`
                     text-4xl font-extrabold px-8 py-4 rounded-3xl shadow-xl border-2 flex items-center gap-3
                     ${winInfo?.winAmount === 300 ? 'bg-white text-yellow-600 border-yellow-200' : 'bg-white text-blue-600 border-blue-200'}
                  `}>
                     +{winInfo?.winAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Moedas <AnimatedIcon type="coin" size={40} />
                  </div>
                  
                  <p className="text-white/80 text-sm mt-6 font-medium">As moedas já foram creditadas na sua banca!</p>
               </div>
            </motion.div>
         )}
      </AnimatePresence>

      <div className="mt-4 w-full" id="tickets-claim-section">
        {canClaimFree ? (
           <div className="bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border border-yellow-500/40 rounded-3xl p-6 flex flex-col items-center text-center shadow-lg relative overflow-hidden transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 p-4 opacity-10 blur-sm pointer-events-none">
                 <Ticket size={100} className="text-yellow-500" />
              </div>
              <h3 className="text-xl font-extrabold text-amber-500 mb-2 relative z-10">Tickets Diários Grátis!</h3>
              <p className="text-sm text-foreground/80 mb-6 relative z-10 max-w-sm">
                 Você tem {user?.plan_type === 'ultra' ? 15 : user?.plan_type === 'premium' ? 9 : user?.plan_type === 'pro' ? 6 : 3} tickets gratuitos aguardando para rodar a roleta. Resgate agora mesmo!
              </p>
              <Button onClick={claimFreeTickets} isLoading={claimingFree} variant="primary" size="lg" className="w-full relative z-10 shadow-[0_0_15px_rgba(245,158,11,0.5)] bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 border-none font-bold">
                 RESGATAR TICKETS GRÁTIS
              </Button>
           </div>
        ) : (
           <div className="bg-secondary/40 border border-border p-6 rounded-3xl flex flex-col items-center gap-3 text-center mt-2">
              <span className="text-2xl font-mono text-muted-foreground font-bold tracking-widest">{nextFreeClaim}</span>
              <span className="text-sm text-muted-foreground">Próximo resgate de tickets grátis disponível no balcão de prêmios.</span>
           </div>
        )}
      </div>
    </div>
  );
}
