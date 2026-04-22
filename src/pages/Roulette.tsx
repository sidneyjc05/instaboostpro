import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Target, Ticket, Zap, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppSound } from '../context/SoundContext';

// Definition of the wheel sections matching the user's requirements
const PRIZES = [
  { value: 0.5, label: "0.5 Moeda", color: "#64748b", probability: 25 },
  { value: 1,   label: "1 Moeda",   color: "#3b82f6", probability: 20 },
  { value: 5,   label: "5 Moedas",  color: "#10b981", probability: 15 },
  { value: 10,  label: "10 Moedas", color: "#8b5cf6", probability: 12 },
  { value: 20,  label: "20 Moedas", color: "#f59e0b", probability: 10 },
  { value: 50,  label: "50 Moedas", color: "#f97316", probability: 8 },
  { value: 100, label: "100 Moedas",color: "#ef4444", probability: 5 },
  { value: 150, label: "150 Moedas",color: "#ec4899", probability: 3 },
  { value: 200, label: "200 Moedas",color: "#06b6d4", probability: 1.5 },
  { value: 300, label: "MEGA",      color: "#eab308", probability: 0.5 },
];

export default function Roulette() {
  const { user, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prizeWin, setPrizeWin] = useState<any>(null);
  
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchRouletteStatus();
  }, []);

  const fetchRouletteStatus = async () => {
    try {
      const res = await fetch('/api/roulette/status');
      if (res.ok) {
        const data = await res.json();
        setCanClaim(data.canClaim);
        if (data.nextClaimTime) {
           setNextClaimTime(data.nextClaimTime);
        }
      }
    } catch {}
  };

  const handleClaimFreeTickets = async () => {
    setClaiming(true);
    try {
      // Simulate reading a device fingerprint token natively or conceptually
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
        showNotification.success("Você recebeu 3 Tickets Grátis!");
        await refreshUser();
        fetchRouletteStatus();
      } else {
        showNotification.error(data.error || "Erro ao resgatar.");
      }
    } catch {
      showNotification.error("Erro de conexão.");
    } finally {
      setClaiming(false);
    }
  };

  const spinRoulette = async () => {
    if (spinning) return;
    if (!user?.tickets || user.tickets < 1) {
       showNotification.error("Você não tem tickets suficientes. Resgate grátis ou compre na Loja.");
       return;
    }

    setSpinning(true);
    setPrizeWin(null);

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
       const randomOffset = Math.floor(Math.random() * (sliceAngle - 10)) + 5; // Add randomness inside the slice
       
       // Because standard math rotates clockwise, but the sections depend on the visual mapping
       // Let's assume top center is pointer. We rotate the wheel so the prize slice is at top.
       const targetAngle = (numSlices - winIndex) * sliceAngle - (sliceAngle / 2) + randomOffset;
       
       // Force 5+ full rotations
       const fullRotations = 5 * 360; 
       const finalRotation = rotation + fullRotations + (360 - (rotation % 360)) + targetAngle;

       setRotation(finalRotation);

       // Wait for animation
       setTimeout(async () => {
          setSpinning(false);
          setPrizeWin(PRIZES[winIndex]);
          playSuccess();
          await refreshUser(); // Update coin balance & ticket balance
       }, 5500); // the duration of the CSS transition
       
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
    <div className="flex flex-col gap-6 pb-10">
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
               {user?.tickets ?? 0} 🎟️
            </span>
        </div>
        <div className="flex-1 bg-secondary/50 border border-border rounded-3xl p-4 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Minhas Moedas</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-yellow-500 flex items-center gap-2">
               {user?.credits.toLocaleString('pt-BR') ?? 0} 💰
            </span>
        </div>
      </div>

      {canClaim && (
         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 border border-primary/30 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center">
                  <Ticket size={20} />
               </div>
               <div>
                  <h4 className="font-bold text-foreground">Diariamente 3 Tickets</h4>
                  <p className="text-xs text-muted-foreground">Você possui tickets grátis disponíveis.</p>
               </div>
            </div>
            <Button variant="primary" onClick={handleClaimFreeTickets} isLoading={claiming} className="w-full md:w-auto">
               Resgatar Grátis
            </Button>
         </motion.div>
      )}

      {/* ROULETTE UI */}
      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center overflow-hidden relative shadow-inner">
         <div className="relative w-64 h-64 md:w-80 md:h-80">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -ml-3 -mt-4 w-0 h-0 border-x-[12px] border-x-transparent border-t-[24px] border-t-foreground z-20" />
            
            {/* Wheel */}
            <div 
               className="w-full h-full rounded-full border-4 border-foreground/10 shadow-[0_0_30px_rgba(0,0,0,0.2)] overflow-hidden transition-transform ease-[cubic-bezier(0.1,0.7,0.1,1)]"
               style={{ 
                  background: createConicGradient(),
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: spinning ? '5s' : '0s'
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
                        className="absolute top-0 left-1/2 w-8 h-[50%] -ml-4 origin-bottom flex items-start justify-center pt-4"
                        style={{ transform: `rotate(${rotateDeg}deg)` }}
                     >
                        <span className="text-white text-[10px] md:text-xs font-bold [writing-mode:vertical-rl] drop-shadow-md">
                           {prize.label}
                        </span>
                     </div>
                  );
               })}
            </div>
            
            {/* Center Peg */}
            <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-card border-4 border-foreground/20 rounded-full -ml-6 -mt-6 shadow-md z-10 flex items-center justify-center">
               <Zap size={16} className="text-primary" />
            </div>
         </div>

         <Button 
            size="lg" 
            variant="primary" 
            className="mt-8 font-bold text-lg px-12 shadow-lg shadow-primary/30 rounded-full" 
            onClick={spinRoulette}
            isLoading={spinning}
         >
            {spinning ? 'Girando...' : 'GIRAR (-1 🎟️)'}
         </Button>
      </div>

      <AnimatePresence>
         {prizeWin && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.8, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.8 }}
               className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-3xl p-6 flex flex-col items-center gap-3 text-center"
            >
               <span className="text-5xl">🎉</span>
               <h3 className="text-2xl font-extrabold text-foreground">Você ganhou!</h3>
               <div className="text-green-500 font-bold text-xl px-4 py-2 bg-background rounded-full border border-green-500/20">
                  +{prizeWin.value} Moedas
               </div>
               <p className="text-muted-foreground text-sm mt-1">O valor foi adicionado a sua conta.</p>
            </motion.div>
         )}
      </AnimatePresence>

      {!canClaim && nextClaimTime && (
         <div className="bg-secondary/40 border border-border p-4 rounded-2xl flex flex-col items-center gap-2 text-center mt-2">
            <span className="text-2xl font-mono text-muted-foreground font-bold">{nextClaimTime}</span>
            <span className="text-xs text-muted-foreground">Próximo resgate de tickets grátis disponível.</span>
         </div>
      )}
      
    </div>
  );
}
