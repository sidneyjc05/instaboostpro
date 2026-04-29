import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { QrCode, Copy, Zap, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppSound } from '../context/SoundContext';

export default function Store() {
  const { user, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ id: string, qrCode: string, pixCode: string, tickets: number, credits: number, exactExpiry: number, pendingPlan?: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [tab, setTab] = useState<'credits' | 'tickets' | 'plans'>('plans');
  const [storeConfig, setStoreConfig] = useState<any>(null);

  useEffect(() => {
    fetch('/api/store/config').then(res => res.json()).then(data => setStoreConfig(data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Check if there is a 'tab' search param
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('tab') === 'plans') {
       setTab('plans');
    } else if (searchParams.get('tab') === 'credits') {
       setTab('credits');
    } else if (searchParams.get('tab') === 'tickets') {
       setTab('tickets');
    }
  }, []);

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
            }
          }
        } catch {}
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [polling, paymentData]);

  const handleBuy = async (credits: number | string, type: 'credits' | 'tickets' | 'plan' = 'credits') => {
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

  let packages = [
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

  let ticketPackages = [
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

  let planPackages = [
    { 
       id: 'pro', 
       name: 'Pro', 
       price: 'R$ 50,00', 
       period: '30 dias',
       color: 'from-green-500/20 to-green-900/20',
       borderColor: 'border-green-500/50',
       ringColor: 'ring-green-500/30',
       benefits: [
          '1.8x moedas nas missões',
          '1.5x moedas ao curtir e seguir',
          '12% de desconto na loja',
          '12 publicações por dia',
          'Tempo máximo de destaque: 24h',
          '6 Tickets grátis diários',
          '1% chance no Mega Jackpot (300 moedas)',
          '+1.000 moedas de bônus mensal',
          '+10% de comissão extra'
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
          '2.3x moedas nas missões',
          '2x moedas ao curtir e seguir',
          '25% de desconto na loja',
          '22 publicações por dia',
          'Tempo máximo de destaque: 36h',
          '9 Tickets grátis diários',
          '3% chance no Mega Jackpot (300 moedas)',
          '+2.500 moedas de bônus mensal',
          'Remoção de anúncios / Ultra clean',
          '+20% de comissão extra'
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
          '2.8x moedas nas missões',
          '2.6x moedas ao curtir e seguir',
          '40% de desconto na loja',
          '40 publicações por dia',
          'Tempo máximo de destaque: 48h',
          '15 Tickets grátis diários',
          '5% chance no Mega Jackpot (300 moedas)',
          '+6.000 moedas de bônus mensal',
          'Suporte VIP 24h & Maior prioridade no Feed',
          'Remoção de anúncios / Ultra clean',
          '+40% de comissão extra'
       ]
    }
  ];

  if (storeConfig) {
      const formatPrice = (num: number) => `R$ ${num.toFixed(2).replace('.', ',')}`;

      let planDiscount = 0;
      if (user?.plan_type === 'pro') planDiscount = 0.12;
      if (user?.plan_type === 'premium') planDiscount = 0.25;
      if (user?.plan_type === 'ultra') planDiscount = 0.40;

      const applyPromoAndPlan = (originalAmount: number) => {
         let amt = originalAmount;
         if (storeConfig.promo && storeConfig.promo.active) {
            const now = new Date().getTime();
            const ex = storeConfig.promo.expiresAt ? new Date(storeConfig.promo.expiresAt).getTime() : Infinity;
            if (now < ex) {
                if (storeConfig.promo.type === 'percent') {
                   amt = amt - (amt * (storeConfig.promo.value / 100));
                } else if (storeConfig.promo.type === 'fixed') {
                   amt = Math.max(0.10, amt - storeConfig.promo.value);
                }
            }
         }
         amt = amt - (amt * planDiscount);
         return amt;
      };

      packages = packages.map(p => ({ ...p, price: storeConfig.coins[p.c] ? formatPrice(applyPromoAndPlan(storeConfig.coins[p.c])) : p.price }));
      ticketPackages = ticketPackages.map(p => ({ ...p, price: storeConfig.tickets[p.c] ? formatPrice(applyPromoAndPlan(storeConfig.tickets[p.c])) : p.price }));
      planPackages = planPackages.map(p => ({ ...p, price: storeConfig.plans[p.id] ? formatPrice(storeConfig.plans[p.id]) : p.price })); // Note: no planDiscount on plans!
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <AnimatePresence mode="wait">
        {paymentSuccess ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 p-8 rounded-3xl flex flex-col items-center gap-6 text-center mt-10"
          >
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1, rotate: [0, 20, -20, 0] }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="text-green-500"
            >
              <CheckCircle size={80} />
            </motion.div>
            <div>
                 <h3 className="text-3xl font-extrabold text-foreground">Pagamento Concluído!</h3>
              <p className="text-green-400 mt-2 text-lg font-bold">
                {paymentData?.pendingPlan ? `Parabéns, você ativou o Plano ${paymentData.pendingPlan.toUpperCase()}!` : 
                 paymentData?.tickets && paymentData.tickets > 0 ? `Parabéns, você comprou ${paymentData.tickets} tickets!` : 
                 `Parabéns, você comprou ${paymentData?.credits ?? 0} moedas!`}
              </p>
              <p className="text-muted-foreground mt-2">Muito obrigado por contribuir. Uma mensagem de agradecimento foi enviada nas suas notificações também!</p>
            </div>
            <Button size="lg" className="mt-4" onClick={() => { setPaymentSuccess(false); setPaymentData(null); }}>
              Voltar para Loja
            </Button>
          </motion.div>
        ) : !paymentData ? (
          <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="text-yellow-500" /> Loja
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Compre moedas para destacar seus links, ou tickets para girar a roleta.</p>
            </div>

            <div className="flex gap-2 p-1 bg-secondary border border-border rounded-xl">
               <button 
                 className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'credits' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                 onClick={() => { playClick(); setTab('credits'); }}
               >
                 Moedas 💰
               </button>
               <button 
                 className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'tickets' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                 onClick={() => { playClick(); setTab('tickets'); }}
               >
                 Tickets 🎟️
               </button>
               <button 
                 className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'plans' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                 onClick={() => { playClick(); setTab('plans'); }}
               >
                 Planos 💎
               </button>
            </div>

            {tab === 'plans' && (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {planPackages.map(pkg => (
                     <div key={pkg.id} className={`relative bg-gradient-to-br ${pkg.color} bg-card border rounded-3xl p-6 flex flex-col gap-4 ${pkg.pop ? `ring-2 ${pkg.ringColor} shadow-xl z-10` : 'hover:bg-secondary/50 transition-all duration-300'} ${pkg.borderColor}`}>
                        {pkg.pop && <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] uppercase font-bold py-1 px-3 w-fit rounded-full shadow-lg z-20 shadow-purple-500/50">Mais Popular</div>}
                        
                        <div className="flex flex-col items-center">
                           <div className="text-2xl mt-4 border-b border-border/50 pb-4 w-full text-center font-black uppercase tracking-widest text-white">
                              {pkg.name}
                           </div>
                           <div className="font-bold text-4xl mt-4">{pkg.price}</div>
                           <div className="text-sm mt-1 text-muted-foreground bg-black/10 dark:bg-white/5 py-1 px-3 rounded-full">Duração: <strong className="text-foreground">{pkg.period}</strong></div>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 mt-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                           {pkg.benefits.map((b, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                 <CheckCircle className="shrink-0 mt-0.5 text-primary" size={16} />
                                 <span className="leading-tight">{b}</span>
                              </div>
                           ))}
                        </div>

                        <Button className="w-full mt-4 h-12 text-lg shadow-lg" variant={pkg.pop ? 'primary' : 'secondary'} onClick={() => handleBuy(pkg.id, 'plan')} isLoading={loading}>
                           Assinar {pkg.name}
                        </Button>
                     </div>
                  ))}
               </div>
            )}

            {tab === 'credits' && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {packages.map(pkg => (
                  <div key={pkg.c} className={`relative bg-card border rounded-3xl p-5 flex flex-col items-center gap-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30 ring-2 ring-primary/20 shadow-md z-10' : 'border-border'}`}>
                    <div className="text-2xl mt-2 border-b border-border/50 pb-2 w-full text-center">
                      <span className="font-bold">{pkg.c.toLocaleString('pt-BR')}</span> <span className="text-lg">💰</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">Destaque por <br/> <strong className="text-foreground">{pkg.time}</strong></div>
                    <div className="font-bold text-lg mt-1">{pkg.price}</div>
                    <Button className="w-full mt-2" variant={pkg.pop ? 'primary' : 'secondary'} onClick={() => handleBuy(pkg.c, 'credits')} isLoading={loading}>
                      Comprar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'tickets' && (
               <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {ticketPackages.map(pkg => (
                     <div key={pkg.c} className={`relative bg-card border rounded-3xl p-5 flex flex-col items-center gap-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30 ring-2 ring-primary/20 shadow-md z-10' : 'border-border'}`}>
                        <div className="text-2xl mt-2 border-b border-border/50 pb-2 w-full text-center">
                           <span className="font-bold">{pkg.c.toLocaleString('pt-BR')}</span> <span className="text-lg">🎟️</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">Gire a roleta e <br/> <strong className="text-foreground">ganhe moedas</strong></div>
                        <div className="font-bold text-lg mt-1">{pkg.price}</div>
                        <Button className="w-full mt-2" variant={pkg.pop ? 'primary' : 'secondary'} onClick={() => handleBuy(pkg.c, 'tickets')} isLoading={loading}>
                           Comprar
                        </Button>
                     </div>
                  ))}
               </div>
            )}
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
                    {paymentData.tickets?.toLocaleString('pt-BR') || paymentData.tickets} Tickets 🎟️
                 </p>
              ) : (
                 <p className="font-bold text-green-500 mt-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30 w-fit mx-auto">
                    {paymentData.credits?.toLocaleString('pt-BR') || paymentData.credits} Moedas 💰
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
