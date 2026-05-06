import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { QrCode, Copy, Zap, CheckCircle, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppSound } from '../context/SoundContext';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { GlobalLoader } from '../components/GlobalLoader';

const PromoBadge = ({ percent, size = 'md' }: { percent: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: { container: 'top-2 right-2', badge: 'py-1 px-2 text-[8px]', circle: 'w-2 h-2', zap: 6 },
    md: { container: 'top-3 right-3 lg:top-4 lg:right-4 w-max', badge: 'py-1 px-2.5 text-[10px] md:text-xs md:py-1.5 md:px-3', circle: 'w-3 h-3', zap: 8 },
    lg: { container: 'top-4 right-4 lg:top-5 lg:right-5 w-max', badge: 'py-1.5 px-3 md:py-2 md:px-4 text-xs md:text-sm', circle: 'w-4 h-4', zap: 12 }
  };

  const s = sizes[size];

  return (
    <motion.div 
      initial={{ scale: 0, rotate: -5 }}
      animate={{ scale: 1, rotate: size === 'md' ? 0 : -6 }}
      whileHover={{ rotate: 0, scale: 1.1 }}
      className={`absolute ${s.container} z-30 pointer-events-none drop-shadow-lg transition-all duration-300 w-max`}
    >
      <div className="relative group/badge flex items-center justify-center">
        <div className="absolute inset-0 bg-red-600 blur-md opacity-30 animate-pulse group-hover/badge:opacity-50 transition-opacity" />
        
        <div className={`relative bg-gradient-to-r from-red-600 to-rose-600 text-white font-black uppercase rounded-full md:rounded-2xl border border-white/20 flex flex-row md:flex-col items-center justify-center gap-1 md:gap-0 leading-none shadow-[0_5px_15px_-3px_rgba(220,38,38,0.5)] ${s.badge}`}>
          <span className="opacity-80 tracking-tight text-[0.7em] md:mb-0.5">Promo</span>
          <span className="tracking-tighter font-black italic">-{percent}%</span>
        </div>

        <div className={`absolute -top-1 -right-1 ${s.circle} bg-white rounded-full flex items-center justify-center shadow border border-red-500`}>
          <Zap size={s.zap === 12 ? 10 : (s.zap === 8 ? 6 : 5)} className="fill-red-600 text-red-600" />
        </div>
      </div>
    </motion.div>
  );
};

export default function Store() {
  const { user, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<{ id: string, paymentMethod: string, qrCode: string, pixCode: string, tickets: number, credits: number, exactExpiry: number, pendingPlan?: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [tab, setTab] = useState<'credits' | 'tickets' | 'plans'>('plans');
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [promoTime, setPromoTime] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

  useEffect(() => {
    if (storeConfig?.promo?.active && storeConfig.promo.expiresAt) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(storeConfig.promo.expiresAt).getTime();
        const diff = expiry - now;

        if (diff <= 0) {
          setPromoTime(null);
          clearInterval(timer);
        } else {
          setPromoTime({
            d: Math.floor(diff / (1000 * 60 * 60 * 24)),
            h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            s: Math.floor((diff % (1000 * 60)) / 1000)
          });
        }
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setPromoTime(null);
    }
  }, [storeConfig]);

  useEffect(() => {
    fetch('/api/store/config')
      .then(res => res.json())
      .then(data => {
        setStoreConfig(data);
        setInitialLoading(false);
      })
      .catch(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    // URL Check params
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('tab') === 'plans') {
       setTab('plans');
    } else if (searchParams.get('tab') === 'credits') {
       setTab('credits');
    } else if (searchParams.get('tab') === 'tickets') {
       setTab('tickets');
    }
  }, []);

  // Use this rendered at the top of the return
  // <GlobalLoader isLoading={initialLoading} />

  // Expiration and countdown timer
  useEffect(() => {
    let timer: any;
    if (paymentData && !paymentSuccess) {
      timer = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((paymentData.exactExpiry - now) / 1000);
        if (diff <= 0) {
           clearInterval(timer);
           setPaymentData(null);
           setPolling(false);
           showNotification.error('Tempo esgotado. Pagamento PIX foi cancelado.');
        } else {
           setTimeLeft(diff);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [paymentData, paymentSuccess]);

  // Poll for payment status
  useEffect(() => {
    let interval: any;
    if (polling && paymentData?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payments/${paymentData.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
               playSuccess();
               showNotification.success('Pagamento PIX Aprovado!');
               setPolling(false);
               setPaymentSuccess(true);
               refreshUser();
            } else if (data.status === 'rejected' || data.status === 'cancelled') {
               showNotification.error('Pagamento recusado ou cancelado.');
               setPolling(false);
               setPaymentData(null);
            }
          }
        } catch {}
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [polling, paymentData]);

  const handleBuy = async (credits: number | string, type: 'credits' | 'tickets' | 'plan' = 'credits', rawPrice: number) => {
    if (type === 'plan' && user?.plan_type && user.plan_type !== 'basic') {
      showNotification.error('Você já possui um plano ativo!');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits, type })
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentData({ 
            ...data, 
            paymentMethod: 'pix',
            exactExpiry: Date.now() + 15 * 60 * 1000, 
            pendingPlan: type === 'plan' ? credits.toString() : undefined,
            tickets: type === 'tickets' ? Number(credits) : 0,
            credits: type === 'credits' ? Number(credits) : 0
        });
        setTimeLeft(15 * 60);
        setPaymentSuccess(false);
        setPolling(true);
      } else {
        showNotification.error(data.error || 'Erro ao gerar PIX');
      }
    } catch {
      showNotification.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  let packages: any[] = [
    { c: 110, price: 'R$ 0,50', time: '22 minutos' },
    { c: 230, price: 'R$ 1,00', time: '46 minutos' },
    { c: 480, price: 'R$ 2,00', time: '1h 36m' },
    { c: 1150, price: 'R$ 5,00', time: '3h 50m' },
    { c: 2300, price: 'R$ 10,00', time: '7h 40m', pop: true },
    { c: 4200, price: 'R$ 20,00', time: '14 horas' },
    { c: 5100, price: 'R$ 50,00', time: '17 horas' },
    { c: 5800, price: 'R$ 100,00', time: '19h 20m' },
    { c: 6500, price: 'R$ 200,00', time: '21h 40m' },
    { c: 7200, price: 'R$ 250,00', time: '24 horas', pop: true }
  ];

  let ticketPackages: any[] = [
    { c: 5, price: 'R$ 1,50' },
    { c: 12, price: 'R$ 3,00' },
    { c: 22, price: 'R$ 5,00' },
    { c: 50, price: 'R$ 10,00' },
    { c: 110, price: 'R$ 20,00' },
    { c: 300, price: 'R$ 50,00' },
    { c: 650, price: 'R$ 100,00', pop: true },
    { c: 1050, price: 'R$ 150,00' },
    { c: 1900, price: 'R$ 250,00' },
    { c: 2400, price: 'R$ 300,00', pop: true }
  ];

  let planPackages: any[] = [
    { 
       id: 'basic', 
       name: 'Basic', 
       price: 'Grátis', 
       period: 'Vitalício',
       color: 'from-blue-500/10 to-blue-900/10',
       borderColor: 'border-blue-500/30',
       ringColor: 'ring-blue-500/20',
       benefits: [
          'Missões Diárias Normais',
          '1x Moedas nas missões',
          'Sem Prêmios Diários',
          '3 Tickets Grátis por Dia',
          '0.001% chance no Mega Jackpot (300 moedas)',
          '68% chance do prêmio mínimo (0.5) na Roleta',
          '1x Moedas por Curtida/Seguir e Reel',
          'Indicações Ilimitadas',
          '500 moedas por Indicação Inicial',
          '8% de Comissão Recorrente',
          '10 Divulgações Ativas Simultâneas'
       ]
    },
    { 
       id: 'pro', 
       name: 'Pro', 
       price: 'R$ 50,00', 
       period: '30 dias',
       color: 'from-green-500/20 to-green-900/20',
       borderColor: 'border-green-500/50',
       ringColor: 'ring-green-500/30',
       benefits: [
          'Missões Diárias ativas',
          '1.8x Moedas nas missões',
          'Prêmios Diários: 300 moedas/dia',
          '6 Tickets Grátis por Dia',
          '1% chance no Mega Jackpot (300 moedas)',
          '50% chance do prêmio mínimo (0.5) na Roleta',
          '1.6x Moedas/Curtida e 1.7x Moedas/Reel',
          'Indicações Ilimitadas',
          '800 moedas por Indicação Inicial',
          '12% de Comissão Recorrente',
          '25 Divulgações Ativas Simultâneas'
       ]
    },
    { 
       id: 'premium', 
       name: 'Premium', 
       price: 'R$ 100,00', 
       period: '30 dias',
       color: 'from-purple-500/20 to-purple-900/20',
       borderColor: 'border-purple-500/50',
       ringColor: 'ring-purple-500/30',
       pop: true,
       benefits: [
          'Missões Diárias ativas',
          '2.3x Moedas nas missões',
          'Prêmios Diários: 800 moedas/dia',
          '9 Tickets Grátis por Dia',
          '3% chance no Mega Jackpot (300 moedas)',
          '35% chance do prêmio mínimo (0.5) na Roleta',
          '2.1x Moedas/Curtida e 2.2x Moedas/Reel',
          'Indicações Ilimitadas',
          '1.200 moedas por Indicação Inicial',
          '18% de Comissão Recorrente',
          '50 Divulgações Ativas Simultâneas'
       ]
    },
    { 
       id: 'ultra', 
       name: 'Ultra', 
       price: 'R$ 150,00', 
       period: '30 dias',
       color: 'from-yellow-400/20 to-orange-600/20',
       borderColor: 'border-yellow-500/50',
       ringColor: 'ring-yellow-500/30',
       benefits: [
          'Missões Diárias ativas',
          '2.8x Moedas nas missões',
          'Prêmios Diários: 2.000 moedas/dia',
          '15 Tickets Grátis por Dia',
          '5% chance no Mega Jackpot (300 moedas)',
          'Apenas 20% chance do prêmio mínimo (0.5) na Roleta',
          '2.5x Moedas/Curtida e 2.6x Moedas/Reel',
          'Indicações Ilimitadas',
          '2.000 moedas por Indicação Inicial',
          '25% de Comissão Recorrente',
          'Divulgações Ativas Ilimitadas'
       ]
    }
  ];

  if (storeConfig) {
      const formatPrice = (num: number) => `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      let planDiscount = 0;
      if (user?.plan_type === 'pro') planDiscount = 0.12;
      if (user?.plan_type === 'premium') planDiscount = 0.25;
      if (user?.plan_type === 'ultra') planDiscount = 0.40;

      const applyPromoAndPlan = (originalAmount: number, type: 'credits' | 'tickets' | 'plan', itemId?: string | number) => {
         let amt = originalAmount;
         const hasPlan = user?.plan_type && user.plan_type !== 'basic';
         
         let applyPromo = false;
         const pCoins = storeConfig.promo?.applyCoins ?? true;
         const pTickets = storeConfig.promo?.applyTickets ?? true;

         if (type === 'credits' && pCoins) applyPromo = true;
         if (type === 'tickets' && pTickets) applyPromo = true;
         if (type === 'plan') {
             if (itemId === 'basic' && (storeConfig.promo?.applyPlanBasic ?? true)) applyPromo = true;
             if (itemId === 'pro' && (storeConfig.promo?.applyPlanPro ?? true)) applyPromo = true;
             if (itemId === 'premium' && (storeConfig.promo?.applyPlanPremium ?? true)) applyPromo = true;
             if (itemId === 'ultra' && (storeConfig.promo?.applyPlanUltra ?? true)) applyPromo = true;
         }

         if ((type === 'tickets' || type === 'credits') && hasPlan) {
            applyPromo = false; 
         }
         
         if (applyPromo && storeConfig.promo && storeConfig.promo.active) {
            const now = new Date().getTime();
            const ex = storeConfig.promo.expiresAt ? new Date(storeConfig.promo.expiresAt).getTime() : Infinity;
            if (now < ex) {
                if (storeConfig.promo.type === 'percent') {
                   amt = Math.max(0.10, amt - (amt * (storeConfig.promo.value / 100)));
                } else if (storeConfig.promo.type === 'fixed') {
                   amt = Math.max(0.10, amt - storeConfig.promo.value);
                }
            }
         }
         
         if (type !== 'plan') {
             amt = Math.max(0.10, amt - (amt * planDiscount));
         }
         
         return amt;
      };

      packages = packages.map(p => {
          const original = storeConfig.coins[p.c];
          if (original) {
              const discounted = applyPromoAndPlan(original, 'credits', p.c);
              return { 
                  ...p, 
                  price: formatPrice(discounted),
                  originalPrice: discounted < original ? formatPrice(original) : undefined,
                  discountPercent: discounted < original ? Math.round(((original - discounted) / original) * 100) : 0,
                  rawPrice: discounted
              };
          }
          return p;
      });

      ticketPackages = ticketPackages.map(p => {
          const original = storeConfig.tickets[p.c];
          if (original) {
              const discounted = applyPromoAndPlan(original, 'tickets', p.c);
              return { 
                  ...p, 
                  price: formatPrice(discounted),
                  originalPrice: discounted < original ? formatPrice(original) : undefined,
                  discountPercent: discounted < original ? Math.round(((original - discounted) / original) * 100) : 0,
                  rawPrice: discounted
              };
          }
          return p;
      });

      const hasActivePaidPlan = user?.plan_type && user.plan_type !== 'basic';
      
      planPackages = planPackages.map(p => {
          const original = storeConfig.plans[p.id];
          const isActive = user?.plan_type === p.id;
          const canPurchase = p.id !== 'basic' && !hasActivePaidPlan;
          
          if (original !== undefined) {
              const discounted = applyPromoAndPlan(original, 'plan', p.id);
              const showDiscount = !isActive && discounted < original && original > 0;
              return { 
                  ...p, 
                  isActive,
                  canPurchase,
                  price: isActive ? 'Ativo' : (discounted === 0 ? 'Grátis' : formatPrice(discounted)),
                  originalPrice: showDiscount ? formatPrice(original) : undefined,
                  discountPercent: showDiscount ? Math.round(((original - discounted) / original) * 100) : 0,
                  rawPrice: discounted
              };
          }
          return p;
      });
  }

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-7xl mx-auto w-full px-4 md:px-0">
      <GlobalLoader isLoading={initialLoading} />
      <AnimatePresence mode="wait">
        {paymentSuccess ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-card border border-green-500/30 p-12 rounded-[2rem] flex flex-col items-center gap-8 text-center mt-10 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1, rotate: [0, 15, -15, 0] }}
              transition={{ 
                scale: { type: "spring", stiffness: 200, damping: 10 },
                rotate: { type: "tween", duration: 0.5, delay: 0.2 }
              }}
              className="text-green-500 bg-green-500/10 p-6 rounded-full"
            >
              <CheckCircle size={100} />
            </motion.div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-foreground tracking-tight">Sucesso Total!</h3>
              <p className="text-green-400 mt-3 text-xl font-bold">
                {paymentData?.pendingPlan ? `Seu Plano ${paymentData.pendingPlan.toUpperCase()} está ATIVADO!` : 
                 paymentData?.tickets && paymentData.tickets > 0 ? `Adicionamos ${paymentData.tickets} tickets à sua conta!` : 
                 `Adicionamos ${paymentData?.credits ?? 0} moedas à sua conta!`}
              </p>
              <p className="text-muted-foreground mt-4 max-w-md mx-auto">Sua contribuição ajuda a manter o servidor rodando e você colhe os benefícios agora mesmo. Aproveite!</p>
            </div>
            <Button size="lg" className="mt-4 px-12 h-14 text-lg rounded-full" onClick={() => { setPaymentSuccess(false); setPaymentData(null); }}>
              Voltar para Loja
            </Button>
          </motion.div>
        ) : !paymentData ? (
          <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-yellow-500/20 text-yellow-500 rounded-xl flex items-center justify-center">
                    <Zap className="fill-yellow-500" size={20} />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-2">
                    Loja Oficial
                    <div className="flex items-center bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full group cursor-help" title="Vendedor Verificado">
                       <CheckCircle size={14} className="text-blue-500 fill-blue-500/20" />
                       <span className="text-[10px] font-black text-blue-500 uppercase ml-1 tracking-widest hidden md:block">Verificado</span>
                    </div>
                  </h2>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
                  Turbine seu perfil com moedas exclusivas ou desbloqueie o poder dos nossos planos VIP para crescimento acelerado.
                </p>
              </div>

              {storeConfig?.promo?.active && (
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-card border border-red-500/30 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden shadow-2xl shadow-red-500/5 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5 pointer-events-none" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/40 relative">
                      <Zap size={28} className="fill-white animate-pulse" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                         <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter text-red-500 italic">Promoção de Elite</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Ofertas Limitadas</p>
                    </div>
                  </div>

                  <div className="flex-1 flex justify-center md:justify-end gap-3 relative z-10">
                    {promoTime ? (
                      <>
                        <div className="flex flex-col items-center">
                          <div className="bg-background/80 backdrop-blur-md border border-border w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-foreground shadow-sm">
                            {promoTime.d.toString().padStart(2, '0')}
                          </div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground mt-1 tracking-widest">Dias</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="bg-background/80 backdrop-blur-md border border-border w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-foreground shadow-sm">
                            {promoTime.h.toString().padStart(2, '0')}
                          </div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground mt-1 tracking-widest">Horas</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="bg-background/80 backdrop-blur-md border border-border w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-foreground shadow-sm">
                            {promoTime.m.toString().padStart(2, '0')}
                          </div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground mt-1 tracking-widest">Min</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="bg-red-500 border border-red-400 w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-lg shadow-red-500/20">
                            {promoTime.s.toString().padStart(2, '0')}
                          </div>
                          <span className="text-[10px] font-black uppercase text-red-500 mt-1 tracking-widest">Seg</span>
                        </div>
                      </>
                    ) : (
                      <div className="bg-red-500/10 border border-red-500/30 px-6 py-3 rounded-2xl">
                         <p className="text-sm font-black text-red-500 uppercase tracking-widest">Válido enquanto durar o estoque!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex p-1.5 bg-secondary/50 border border-border rounded-2xl backdrop-blur-sm sticky top-4 z-40 shadow-xl shadow-black/5">
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${tab === 'plans' ? 'bg-background shadow-lg text-primary scale-[1.02] border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => { playClick(); setTab('plans'); }}
               >
                 <AnimatedIcon type="diamond" size={20} /> Planos VIP
               </button>
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${tab === 'credits' ? 'bg-background shadow-lg text-primary scale-[1.02] border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => { playClick(); setTab('credits'); }}
               >
                 <AnimatedIcon type="coin" size={20} /> Moedas
               </button>
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${tab === 'tickets' ? 'bg-background shadow-lg text-primary scale-[1.02] border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => { playClick(); setTab('tickets'); }}
               >
                 <AnimatedIcon type="ticket" size={20} /> Tickets
               </button>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'plans' && (
                <motion.div 
                  key="plans-tab"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
                >
                  {planPackages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`group relative bg-card border rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 flex flex-col gap-4 sm:gap-6 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${pkg.pop ? `ring-2 ${pkg.ringColor} shadow-xl z-20` : 'hover:border-primary/50 z-10'} ${pkg.borderColor}`}
                    >
                      {/* Background Accents - Moved overflow-hidden to this specifically to allow outer badges to show */}
                      <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className={`absolute inset-0 bg-gradient-to-br ${pkg.color} opacity-40 group-hover:opacity-60 transition-opacity`} />
                      </div>
                      
                      {pkg.pop && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 w-max bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white text-[9px] sm:text-[10px] uppercase font-black py-1.5 px-5 rounded-full shadow-2xl z-30 animate-bounce cursor-default border border-white/20 whitespace-nowrap">
                          🔥 Recomendado
                        </div>
                      )}

                      {pkg.discountPercent > 0 && !pkg.isActive && (
                        <PromoBadge percent={pkg.discountPercent} size="lg" />
                      )}

                      <div className="relative z-10">
                        <div className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter text-foreground mb-1 leading-none">
                          {pkg.name}
                        </div>
                        <div className="text-muted-foreground font-medium text-[9px] sm:text-xs lg:text-sm flex items-center gap-2">
                           MODO {pkg.id.toUpperCase()} • <span className="text-foreground/80">{pkg.period}</span>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col mt-2 sm:mt-4">
                        <div className="flex items-end gap-1">
                          <span className={`text-4xl sm:text-5xl font-black tracking-tight leading-none ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>
                            {pkg.price}
                          </span>
                        </div>
                        {pkg.originalPrice && (
                          <span className="text-xs sm:text-sm text-red-500/80 font-bold line-through mt-1">
                            {pkg.originalPrice}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-4 bg-black/20 dark:bg-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-md border border-white/5">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Vantagens Exclusivas</p>
                        <div className="flex flex-col gap-2.5 sm:gap-3 overflow-y-auto max-h-[200px] sm:max-h-[300px] pr-1 custom-scrollbar">
                           {pkg.benefits.map((b, i) => (
                              <div key={i} className="flex items-start gap-2 lg:gap-3 text-xs lg:text-sm font-medium text-foreground/90 leading-tight">
                                 <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle className="text-primary" size={12} />
                                 </div>
                                 <span className="leading-snug">{b}</span>
                              </div>
                           ))}
                        </div>
                      </div>

                      <Button 
                        className="relative z-10 w-full h-14 sm:h-16 text-sm sm:text-lg font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-xl transition-all active:scale-95 group-hover:scale-[1.02]" 
                        variant={pkg.isActive ? 'outline' : (pkg.pop ? 'primary' : 'secondary')} 
                        disabled={pkg.isActive || (user?.plan_type !== 'basic' && !pkg.isActive)}
                        onClick={() => handleBuy(pkg.id, 'plan', pkg.rawPrice)} 
                        isLoading={loading}
                      >
                         {pkg.isActive ? 'Plano Ativo' : (user?.plan_type && user.plan_type !== 'basic' ? 'Indisponível' : 'Ativar Agora')}
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {tab === 'credits' && (
                <motion.div 
                  key="credits-tab"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                >
                  {packages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.c} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`group relative bg-card border rounded-[2rem] p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:shadow-xl hover:border-primary/50 ${pkg.pop ? 'bg-gradient-to-br from-primary/10 to-blue-900/10 border-primary/30 ring-1 ring-primary/20 z-10 scale-[1.05] shadow-lg shadow-primary/5' : 'border-border'}`}
                    >
                      {pkg.discountPercent > 0 && (
                        <PromoBadge percent={pkg.discountPercent} size="md" />
                      )}
                      
                      {pkg.pop && (
                        <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-[9px] font-black uppercase py-1.5 px-3 rounded-lg shadow-xl z-20">
                          Popular
                        </div>
                      )}

                      <div className="w-full flex flex-col items-center gap-1 border-b border-border/50 pb-4">
                        <div className="flex items-center gap-2">
                           <span className="text-3xl font-black tracking-tight">{pkg.c.toLocaleString('pt-BR')}</span>
                           <AnimatedIcon type="coin" size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Moedas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1 text-center py-2 h-16 justify-center">
                        <div className="text-xs text-muted-foreground font-medium">Destaque por</div>
                        <div className="text-sm font-black text-foreground">{pkg.time}</div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-2">
                        {pkg.originalPrice && <span className="text-xs text-red-500/80 font-bold line-through">{pkg.originalPrice}</span>}
                        <span className={`text-2xl font-black ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>{pkg.price}</span>
                      </div>

                      <Button 
                        className="w-full overflow-hidden relative group" 
                        variant={pkg.pop ? 'primary' : 'secondary'} 
                        onClick={() => handleBuy(pkg.c, 'credits', pkg.rawPrice)} 
                        isLoading={loading}
                        size="lg"
                      >
                        <span className="relative z-10">COMPRAR</span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {tab === 'tickets' && (
                <motion.div 
                  key="tickets-tab"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                >
                  {ticketPackages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.c} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`group relative bg-card border rounded-[2rem] p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:shadow-xl hover:border-primary/50 ${pkg.pop ? 'bg-gradient-to-br from-primary/10 to-blue-900/10 border-primary/30 ring-1 ring-primary/20 z-10 scale-[1.05] shadow-lg shadow-primary/5' : 'border-border'}`}
                    >
                      {pkg.discountPercent > 0 && (
                        <PromoBadge percent={pkg.discountPercent} size="md" />
                      )}

                      <div className="w-full flex flex-col items-center gap-1 border-b border-border/50 pb-4">
                        <div className="flex items-center gap-2">
                           <span className="text-3xl font-black tracking-tight">{pkg.c.toLocaleString('pt-BR')}</span>
                           <AnimatedIcon type="ticket" size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tickets</span>
                      </div>

                      <div className="flex flex-col items-center gap-1 text-center py-2 h-16 justify-center">
                        <div className="text-xs text-muted-foreground font-medium leading-tight px-2">Gire a roleta e ganhe recompensas</div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-2">
                        {pkg.originalPrice && <span className="text-xs text-red-500/80 font-bold line-through">{pkg.originalPrice}</span>}
                        <span className={`text-2xl font-black ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>{pkg.price}</span>
                      </div>

                      <Button 
                        className="w-full overflow-hidden relative group" 
                        variant={pkg.pop ? 'primary' : 'secondary'} 
                        onClick={() => handleBuy(pkg.c, 'tickets', pkg.rawPrice)} 
                        isLoading={loading}
                        size="lg"
                      >
                        <span className="relative z-10">COMPRAR</span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            key="payment"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center gap-6 text-center"
          >
            <div className="flex w-full justify-between items-center bg-secondary/50 p-3 rounded-2xl border border-border">
              <span className="text-sm font-semibold">Tempo restante</span>
              <span className="text-lg font-mono font-bold text-destructive animate-pulse">{formatTime(timeLeft)}</span>
            </div>

            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
              <QrCode size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Escaneie o QR Code</h3>
              <p className="text-sm text-muted-foreground mt-1">Aprovação em segundos. Escaneie pelo app do seu banco para pagar via PIX.</p>
              {paymentData.pendingPlan ? (
                 <p className="font-bold text-yellow-500 mt-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30 w-fit mx-auto">
                    Plano {paymentData.pendingPlan.toUpperCase()} (30 dias)
                 </p>
              ) : paymentData.tickets > 0 ? (
                 <p className="font-bold text-blue-500 mt-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30 w-fit mx-auto">
                    {paymentData.tickets?.toLocaleString('pt-BR') || paymentData.tickets} Tickets <AnimatedIcon type="ticket" className="ml-1" size={16} />
                 </p>
              ) : (
                 <p className="font-bold text-green-500 mt-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30 w-fit mx-auto">
                    {paymentData.credits?.toLocaleString('pt-BR') || paymentData.credits} Moedas <AnimatedIcon type="coin" className="ml-1" size={16} />
                 </p>
              )}
            </div>
            
                {paymentData.qrCode ? (
                  <div className="p-2 bg-white rounded-xl">
                    <img src={paymentData.qrCode} alt="PIX QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="p-2 bg-white rounded-xl w-48 h-48 flex items-center justify-center text-xs text-black/50 text-center font-medium">
                    QR Code apenas via app MercadoPago
                  </div>
                )}
    
                <div className="w-full flex gap-2">
                  <div className="flex-1 bg-secondary rounded-xl px-3 py-2 text-xs truncate border border-border flex items-center text-left">
                    {paymentData.pixCode?.substring(0, 30)}...
                  </div>
                  <Button 
                     variant="outline"
                     onClick={() => {
                       navigator.clipboard.writeText(paymentData.pixCode);
                       showNotification.success('Código PIX copiado!');
                     }}
                  >
                    <Copy size={16} /> Copiar
                  </Button>
                </div>
    
                <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                  <Loader2 className="animate-spin" size={16} /> Aguardando pagamento do PIX...
                </div>
            
            <Button variant="secondary" className="mt-4" onClick={() => setPaymentData(null)}>
              Cancelar Operação
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Temporary for loader
const Loader2 = ({ size, className }: any) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
