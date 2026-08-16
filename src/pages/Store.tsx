import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { QrCode, Copy, Zap, CheckCircle, CreditCard, Gift, Coins, Diamond, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppSound } from '../context/SoundContext';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { GlobalLoader } from '../components/GlobalLoader';
import { CheckoutModal, CheckoutItem } from '../components/CheckoutModal';

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [tab, setTab] = useState<'credits' | 'tickets' | 'plans'>('plans');
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [promoTime, setPromoTime] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCheckoutItem, setSelectedCheckoutItem] = useState<CheckoutItem | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    pendingPlan?: string;
    tickets?: number;
    credits?: number;
    paymentMethod?: string;
    approvedAt?: string;
  } | null>(null);

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

  const handleOpenCheckout = (item: CheckoutItem) => {
    if (item.type === 'plan' && user?.plan_type && user.plan_type !== 'basic') {
      showNotification.error('Você já possui um plano VIP ativo!');
      return;
    }
    playClick();
    setSelectedCheckoutItem(item);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = (data: any) => {
    playSuccess();
    setPaymentSuccessData({
      pendingPlan: selectedCheckoutItem?.type === 'plan' ? String(selectedCheckoutItem.credits) : undefined,
      tickets: selectedCheckoutItem?.type === 'tickets' ? Number(selectedCheckoutItem.credits) : 0,
      credits: selectedCheckoutItem?.type === 'credits' ? Number(selectedCheckoutItem.credits) : 0,
      paymentMethod: data?.paymentMethod || 'pix',
      approvedAt: new Date().toLocaleTimeString('pt-BR')
    });
    refreshUser();
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
          '10% de Comissão Recorrente',
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
          'Prêmios Diários: até 300 moedas/dia',
          '6 Tickets Grátis por Dia',
          '1% chance no Mega Jackpot (300 moedas)',
          '50% chance do prêmio mínimo (0.5) na Roleta',
          '1.6x Moedas/Curtida e 1.7x Moedas/Reel',
          'Indicações Ilimitadas',
          '800 moedas por Indicação Inicial',
          '20% de Comissão Recorrente',
          '12% de DESCONTO em Moedas e Tickets',
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
          'Prêmios Diários: até 800 moedas/dia',
          '9 Tickets Grátis por Dia',
          '3% chance no Mega Jackpot (300 moedas)',
          '35% chance do prêmio mínimo (0.5) na Roleta',
          '2.1x Moedas/Curtida e 2.2x Moedas/Reel',
          'Indicações Ilimitadas',
          '1.200 moedas por Indicação Inicial',
          '30% de Comissão Recorrente',
          '25% de DESCONTO em Moedas e Tickets',
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
          'Prêmios Diários Massivos (até 2500 moedas/dia)',
          '15 Tickets Grátis por Dia',
          '8% chance no Mega Jackpot (300 moedas)',
          '25% chance do prêmio mínimo (0.5) na Roleta',
          '2.6x Moedas/Curtida e 2.7x Moedas/Reel',
          'Indicações Ilimitadas',
          '2.000 moedas por Indicação Inicial',
          '50% de Comissão Recorrente',
          '40% de DESCONTO em Moedas e Tickets',
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
         
         let promoDiscountVal = 0;
         const pCoins = storeConfig.promo?.applyCoins ?? true;
         const pTickets = storeConfig.promo?.applyTickets ?? true;

         let canApplyPromo = false;
         if (type === 'credits' && pCoins) canApplyPromo = true;
         if (type === 'tickets' && pTickets) canApplyPromo = true;
         if (type === 'plan') {
             if (itemId === 'basic' && (storeConfig.promo?.applyPlanBasic ?? true)) canApplyPromo = true;
             if (itemId === 'pro' && (storeConfig.promo?.applyPlanPro ?? true)) canApplyPromo = true;
             if (itemId === 'premium' && (storeConfig.promo?.applyPlanPremium ?? true)) canApplyPromo = true;
             if (itemId === 'ultra' && (storeConfig.promo?.applyPlanUltra ?? true)) canApplyPromo = true;
         }

         if (canApplyPromo && storeConfig.promo && storeConfig.promo.active) {
            const now = new Date().getTime();
            const ex = storeConfig.promo.expiresAt ? new Date(storeConfig.promo.expiresAt).getTime() : Infinity;
            if (now < ex) {
                if (storeConfig.promo.type === 'percent') {
                   promoDiscountVal = storeConfig.promo.value / 100;
                }
            }
         }
         
         // Select the best discount between Promo and Plan
         // If it's a plan purchase, we usually only apply promo (if allowed)
         let finalDiscount = 0;
         if (type !== 'plan') {
             finalDiscount = Math.max(promoDiscountVal, planDiscount);
         } else {
             finalDiscount = promoDiscountVal;
         }
         
         if (finalDiscount > 0) {
            amt = Math.max(0.10, amt - (amt * finalDiscount));
         } else if (canApplyPromo && storeConfig.promo && storeConfig.promo.active && storeConfig.promo.type === 'fixed') {
            // Fallback for fixed value promos if no percentage discount was better
            const now = new Date().getTime();
            const ex = storeConfig.promo.expiresAt ? new Date(storeConfig.promo.expiresAt).getTime() : Infinity;
            if (now < ex) {
                amt = Math.max(0.10, amt - storeConfig.promo.value);
            }
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
        {paymentSuccessData ? (
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-wider mb-3 border border-green-500/20">
                <Sparkles size={14} /> Pagamento Confirmado ({paymentSuccessData.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'PIX Instantâneo'})
              </div>
              <h3 className="text-4xl font-black text-foreground tracking-tight">Sucesso Total!</h3>
              <p className="text-green-400 mt-3 text-xl font-bold">
                {paymentSuccessData.pendingPlan ? `Seu Plano ${paymentSuccessData.pendingPlan.toUpperCase()} está ATIVADO!` : 
                 paymentSuccessData.tickets && paymentSuccessData.tickets > 0 ? `Adicionamos ${paymentSuccessData.tickets.toLocaleString('pt-BR')} tickets à sua conta!` : 
                 `Adicionamos ${(paymentSuccessData.credits ?? 0).toLocaleString('pt-BR')} moedas à sua conta!`}
              </p>
              <p className="text-muted-foreground mt-4 max-w-md mx-auto">
                Verificação e aprovação registradas com segurança no Firebase e Mercado Pago. Aproveite todos os benefícios agora mesmo!
              </p>
            </div>
            <Button size="lg" className="mt-4 px-12 h-14 text-lg rounded-full" onClick={() => setPaymentSuccessData(null)}>
              Voltar para Loja
            </Button>
          </motion.div>
        ) : (
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

            <div className="flex p-2 bg-secondary/30 border border-border/50 rounded-2xl backdrop-blur-md sticky top-4 z-40 shadow-2xl shadow-black/10 max-w-4xl mx-auto w-full">
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-500 ${tab === 'plans' ? 'bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-primary scale-[1.03] border border-border/60' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                 onClick={() => { playClick(); setTab('plans'); }}
               >
                 <AnimatedIcon type="diamond" size={18} /> Planos VIP
               </button>
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-500 ${tab === 'credits' ? 'bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-primary scale-[1.03] border border-border/60' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                 onClick={() => { playClick(); setTab('credits'); }}
               >
                 <AnimatedIcon type="coin" size={18} /> Moedas
               </button>
               <button 
                 className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-500 ${tab === 'tickets' ? 'bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-primary scale-[1.03] border border-border/60' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                 onClick={() => { playClick(); setTab('tickets'); }}
               >
                 <AnimatedIcon type="ticket" size={18} /> Tickets
               </button>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'plans' && (
                <motion.div 
                  key="plans-tab"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8"
                >
                  {planPackages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`group relative bg-card border rounded-[2.5rem] p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:-translate-y-2 ${pkg.pop ? `ring-2 ${pkg.ringColor} shadow-xl z-20` : 'hover:border-primary/50 z-10'} ${pkg.borderColor}`}
                    >
                      {/* Background Accents */}
                      <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className={`absolute inset-0 bg-gradient-to-br ${pkg.color} opacity-30 group-hover:opacity-50 transition-opacity duration-500`} />
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/10 transition-colors" />
                      </div>
                      
                      {pkg.pop && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-max bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white text-[10px] uppercase font-black py-2 px-6 rounded-full shadow-2xl z-30 animate-pulse cursor-default border border-white/20 tracking-widest whitespace-nowrap">
                          🔥 Recomendado
                        </div>
                      )}

                      {pkg.discountPercent > 0 && !pkg.isActive && (
                        <PromoBadge percent={pkg.discountPercent} size="lg" />
                      )}

                      <div className="relative z-10">
                        <div className="text-3xl lg:text-4xl font-black uppercase italic tracking-tighter text-foreground mb-1.5 leading-none">
                          {pkg.name}
                        </div>
                        <div className="text-muted-foreground font-black text-[10px] lg:text-xs flex items-center gap-2 uppercase tracking-widest opacity-70">
                           MODO {pkg.id.toUpperCase()} • <span className="text-foreground tracking-normal font-bold normal-case">{pkg.period}</span>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col mt-2">
                        <div className="flex items-end gap-1 flex-wrap">
                          <span className={`text-5xl lg:text-6xl font-black tracking-tighter leading-none ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>
                            {pkg.price}
                          </span>
                        </div>
                        {pkg.originalPrice && (
                          <span className="text-sm lg:text-base text-red-500/80 font-black line-through mt-2 italic">
                            {pkg.originalPrice}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col gap-4 mt-2 bg-secondary/20 dark:bg-black/40 rounded-3xl p-6 backdrop-blur-xl border border-white/5 shadow-inner">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-2 opacity-50">Vantagens Exclusivas</p>
                        <div className="flex flex-col gap-4">
                           {pkg.benefits.map((b, i) => {
                                let Icon = CheckCircle;
                                let iconColor = "text-primary";
                                if (b.includes('x Moedas')) {
                                    Icon = Zap;
                                    iconColor = "text-yellow-500 fill-yellow-500/20";
                                } else if (b.includes('Prêmios Diários')) {
                                    Icon = Gift;
                                    iconColor = "text-purple-500";
                                } else if (b.includes('Jackpot') || b.includes('Roleta') || b.includes('Tickets')) {
                                    Icon = Coins;
                                    iconColor = "text-orange-500";
                                } else if (b.includes('Comissão')) {
                                    Icon = Diamond;
                                    iconColor = "text-cyan-400";
                                }

                                return (
                                <div key={i} className="flex items-start gap-3 text-sm font-bold text-foreground/90 leading-tight group/item">
                                   <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover/item:bg-foreground/5 transition-colors`}>
                                      <Icon className={iconColor} size={14} />
                                   </div>
                                   <span className="leading-snug tracking-tight">{b}</span>
                                </div>
                           )})}
                        </div>
                      </div>

                      <Button 
                        className={`relative z-10 w-full h-16 lg:h-20 text-base lg:text-xl font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden group/btn ${pkg.isActive ? 'opacity-80' : 'active:scale-[0.98] hover:scale-[1.02]'}`} 
                        variant={pkg.isActive ? 'outline' : (pkg.pop ? 'primary' : 'secondary')} 
                        disabled={pkg.isActive || (user?.plan_type !== 'basic' && !pkg.isActive)}
                        onClick={() => handleOpenCheckout({
                          credits: pkg.id,
                          type: 'plan',
                          rawPrice: pkg.rawPrice ?? (pkg.id === 'pro' ? 50 : pkg.id === 'premium' ? 100 : 150),
                          title: `Plano ${pkg.name}`,
                          subtitle: `Acesso VIP por ${pkg.period}`,
                          priceFormatted: pkg.price,
                          originalPrice: pkg.originalPrice,
                          discountPercent: pkg.discountPercent,
                          time: pkg.period
                        })} 
                      >
                         <span className="relative z-20">
                            {pkg.isActive ? 'Plano Ativo' : (user?.plan_type && user.plan_type !== 'basic' ? 'Indisponível' : 'Ativar Agora')}
                         </span>
                         {!pkg.isActive && (
                           <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                         )}
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
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 lg:gap-8"
                >
                  {packages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.c} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`group relative bg-card border rounded-[2.5rem] p-6 lg:p-8 flex flex-col items-center gap-4 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] hover:-translate-y-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/10 to-blue-900/10 border-primary/30 ring-1 ring-primary/20 z-10 scale-[1.05] shadow-lg shadow-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors" />
                      </div>

                      {pkg.discountPercent > 0 && (
                        <PromoBadge percent={pkg.discountPercent} size="md" />
                      )}
                      
                      {pkg.pop && (
                        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-black uppercase py-1.5 px-4 rounded-full shadow-xl z-20 border border-white/20 tracking-widest animate-bounce">
                          Popular
                        </div>
                      )}

                      <div className="w-full flex flex-col items-center gap-1 border-b border-white/5 pb-4 relative z-10">
                        <div className="flex items-center gap-2 group-hover:scale-110 transition-transform duration-500">
                           <span className="text-3xl lg:text-4xl font-black tracking-tight">{pkg.c.toLocaleString('pt-BR')}</span>
                           <AnimatedIcon type="coin" size={28} />
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Moedas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1 text-center py-2 h-16 justify-center relative z-10">
                        <div className="text-[10px] lg:text-xs text-muted-foreground font-black uppercase tracking-widest opacity-40">Destaque por</div>
                        <div className="text-sm lg:text-base font-black text-foreground italic">{pkg.time}</div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-2 relative z-10">
                        {pkg.originalPrice && <span className="text-xs text-red-500/80 font-black line-through italic">{pkg.originalPrice}</span>}
                        <span className={`text-3xl font-black tracking-tighter ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>{pkg.price}</span>
                      </div>

                      <Button 
                        className="w-full h-12 lg:h-14 overflow-hidden relative group/btn2 rounded-xl lg:rounded-2xl shadow-lg hover:shadow-primary/20 transition-all font-black uppercase tracking-widest" 
                        variant={pkg.pop ? 'primary' : 'secondary'} 
                        onClick={() => handleOpenCheckout({
                          credits: pkg.c,
                          type: 'credits',
                          rawPrice: pkg.rawPrice ?? 5,
                          title: `${pkg.c.toLocaleString('pt-BR')} Moedas`,
                          subtitle: pkg.time ? `Destaque por ${pkg.time}` : 'Pacote de moedas',
                          priceFormatted: pkg.price,
                          originalPrice: pkg.originalPrice,
                          discountPercent: pkg.discountPercent,
                          time: pkg.time
                        })} 
                        size="lg"
                      >
                        <span className="relative z-10">COMPRAR</span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn2:translate-y-0 transition-transform duration-300" />
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
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 lg:gap-8"
                >
                  {ticketPackages.map((pkg, idx) => (
                    <motion.div 
                      key={pkg.c} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`group relative bg-card border rounded-[2.5rem] p-6 lg:p-8 flex flex-col items-center gap-4 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] hover:-translate-y-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/10 to-blue-900/10 border-primary/30 ring-1 ring-primary/20 z-10 scale-[1.05] shadow-lg shadow-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors" />
                      </div>

                      {pkg.discountPercent > 0 && (
                        <PromoBadge percent={pkg.discountPercent} size="md" />
                      )}

                      {pkg.pop && (
                        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[9px] font-black uppercase py-1.5 px-4 rounded-full shadow-xl z-20 border border-white/20 tracking-widest animate-bounce">
                          Melhor Valor
                        </div>
                      )}

                      <div className="w-full flex flex-col items-center gap-1 border-b border-white/5 pb-4 relative z-10">
                        <div className="flex items-center gap-2 group-hover:scale-110 transition-transform duration-500">
                           <span className="text-3xl lg:text-4xl font-black tracking-tight">{pkg.c.toLocaleString('pt-BR')}</span>
                           <AnimatedIcon type="ticket" size={28} />
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Tickets</span>
                      </div>

                      <div className="flex flex-col items-center gap-1 text-center py-2 h-16 justify-center relative z-10">
                        <div className="text-[10px] lg:text-xs text-muted-foreground font-black uppercase tracking-widest opacity-40">Recompensas</div>
                        <div className="text-xs lg:text-sm font-bold text-foreground leading-tight px-1 italic">Gire a roleta e ganhe prêmios reais</div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-2 relative z-10">
                        {pkg.originalPrice && <span className="text-xs text-red-500/80 font-black line-through italic">{pkg.originalPrice}</span>}
                        <span className={`text-3xl font-black tracking-tighter ${pkg.originalPrice ? 'text-green-500' : 'text-foreground'}`}>{pkg.price}</span>
                      </div>

                      <Button 
                        className="w-full h-12 lg:h-14 overflow-hidden relative group/btn2 rounded-xl lg:rounded-2xl shadow-lg hover:shadow-primary/20 transition-all font-black uppercase tracking-widest" 
                        variant={pkg.pop ? 'primary' : 'secondary'} 
                        onClick={() => handleOpenCheckout({
                          credits: pkg.c,
                          type: 'tickets',
                          rawPrice: pkg.rawPrice ?? 5,
                          title: `${pkg.c.toLocaleString('pt-BR')} Tickets da Sorte`,
                          subtitle: 'Giros na Roleta de Prêmios',
                          priceFormatted: pkg.price,
                          originalPrice: pkg.originalPrice,
                          discountPercent: pkg.discountPercent
                        })} 
                        size="lg"
                      >
                        <span className="relative z-10">COMPRAR</span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn2:translate-y-0 transition-transform duration-300" />
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={selectedCheckoutItem}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}
