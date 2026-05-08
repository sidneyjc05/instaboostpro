import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Mail, LogOut, Loader2, Diamond, Users, Copy, CheckCircle, Share2, AlertTriangle, ShieldCheck, History, PlusSquare, X, Check, Clock, Zap, Gift, Coins, PlaySquare, Heart } from 'lucide-react';

// Componente do Cronômetro do Plano
function PlanCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<{ months: number; days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = new Date(expiresAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      // Aproximação simples para meses (30 dias)
      const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
      const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ months, days, hours, minutes, seconds: 0 });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // Atualiza a cada minuto para economizar CPU
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex flex-col items-center mt-4 p-4 rounded-3xl bg-background/50 border border-border/50 shadow-inner">
      <div className="flex items-center gap-1.5 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
        <Clock size={12} className="text-primary" /> Tempo Restante do Plano
      </div>
      <div className="flex items-center justify-center gap-2">
        {timeLeft.months > 0 && (
          <>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shadow-lg shadow-blue-500/5">
                <span className="text-lg sm:text-xl font-black text-blue-500 leading-none">{timeLeft.months}</span>
                <span className="text-[8px] sm:text-[9px] uppercase font-bold text-blue-500/60 mt-0.5">Mês</span>
              </div>
            </div>
            <div className="text-muted-foreground/20 font-bold">:</div>
          </>
        )}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex flex-col items-center justify-center shadow-lg shadow-green-500/5">
            <span className="text-lg sm:text-xl font-black text-green-500 leading-none">{timeLeft.days}</span>
            <span className="text-[8px] sm:text-[9px] uppercase font-bold text-green-500/60 mt-0.5">Dias</span>
          </div>
        </div>
        <div className="text-muted-foreground/20 font-bold">:</div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center shadow-lg shadow-amber-500/5">
            <span className="text-lg sm:text-xl font-black text-amber-500 leading-none">{timeLeft.hours}</span>
            <span className="text-[8px] sm:text-[9px] uppercase font-bold text-amber-500/60 mt-0.5">Horas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useAppSound } from '../context/SoundContext';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { showNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { GlobalLoader } from '../components/GlobalLoader';

// Componente Item de Divulgação com Countdown
function PromotionItem({ promo, onRefresh, isExpired, playClick, playSuccess }: any) {
  const [timeLeft, setTimeLeft] = useState<{ m: number; s: number; totalSec: number } | null>(null);
  const [deleteIn, setDeleteIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculate = () => {
      const now = Date.now();
      const target = new Date(promo.expires_at).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(null);
        // Lógica de 5 minutos para deletar após expirar
        const deleteTarget = target + 5 * 60 * 1000;
        const deleteDiff = deleteTarget - now;
        if (deleteDiff > 0) {
           setDeleteIn(Math.floor(deleteDiff / 1000));
        } else {
           setDeleteIn(0);
           onRefresh(); // Trigger refresh to remove from list
        }
        return;
      }

      const m = Math.floor(diff / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ m, s, totalSec: Math.floor(diff / 1000) });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [promo.expires_at, onRefresh]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleReboost = async () => {
    playClick();
    setLoading(true);
    try {
      const res = await fetch(`/api/promotions/${promo.id}/reboost`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        playSuccess();
        showNotification.success('Divulgação renovada!');
        onRefresh();
      } else {
        showNotification.error(data.error || 'Erro ao renovar');
      }
    } catch {
      showNotification.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const getInstaType = (url: string) => {
     if (url.includes('/reel/')) return 'REEL';
     if (url.includes('/p/')) return 'POST';
     return 'PERFIL';
  };

  const type = getInstaType(promo.url);
  const typeColors = {
    'REEL': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'POST': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'PERFIL': 'bg-primary/10 text-primary border-primary/20'
  };

  return (
    <div className={`group relative p-5 rounded-[2rem] border transition-all flex flex-col gap-5 ${
      isExpired 
        ? 'bg-destructive/5 border-destructive/10 opacity-70 hover:opacity-100 hover:border-destructive/30 grayscale-[0.5]' 
        : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-primary/30 shadow-xl shadow-black/20'
    }`}>
       {/* Status Badges */}
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
             <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${typeColors[type]}`}>
                {type}
             </span>
             {isExpired && (
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                  Expirado
                </span>
             )}
          </div>
          
          <div className="flex items-center gap-3">
             <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                   <AnimatedIcon type="coin" size={14} />
                   <span className="text-sm font-black whitespace-nowrap">{(promo.interactions_count * 0.2).toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1 justify-end opacity-60">
                   <Users size={10} />
                   <span className="text-[10px] font-bold uppercase tracking-tight">{promo.interactions_count} Envios</span>
                </div>
             </div>
          </div>
       </div>

       {/* URL Content */}
       <div className="flex items-center gap-3 bg-black/20 rounded-2xl p-3 border border-white/5 group-hover:border-white/10 transition-colors">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isExpired ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
             {type === 'REEL' ? <PlaySquare size={20} /> : type === 'POST' ? <Heart size={20} /> : <UserIcon size={20} />}
          </div>
          <div className="flex flex-col min-w-0">
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Link Impulsionado</span>
             <span className="text-xs font-bold truncate text-foreground/80">{promo.url}</span>
          </div>
       </div>

       {/* Timer and Action */}
       <div className={`flex items-center justify-between gap-4 pt-3 border-t border-white/5`}>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">
                {isExpired ? 'Sone em' : 'Tempo Restante'}
             </span>
             <div className="flex items-center gap-2">
                <Clock size={18} className={isExpired ? 'text-destructive' : 'text-primary animate-pulse'} />
                <span className={`text-2xl font-black tabular-nums tracking-tighter ${isExpired ? 'text-destructive italic' : 'text-foreground'}`}>
                   {timeLeft ? (
                      `${timeLeft.m.toString().padStart(2, '0')}:${timeLeft.s.toString().padStart(2, '0')}`
                   ) : (
                      deleteIn !== null ? formatTime(deleteIn) : '00:00'
                   )}
                </span>
             </div>
          </div>

          <div className="flex gap-2">
             {isExpired ? (
                <Button 
                   onClick={handleReboost} 
                   isLoading={loading}
                   className="rounded-2xl font-black bg-primary text-primary-foreground hover:bg-primary/90 px-6 h-12 shadow-lg shadow-primary/20"
                >
                   RENOVAR
                </Button>
             ) : (
                <div className="p-3 bg-secondary/50 rounded-2xl border border-white/5 flex items-center gap-2 opacity-50">
                   <Zap size={16} className="text-primary fill-primary" />
                   <span className="text-[10px] font-black uppercase tracking-wider">Ativo</span>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { playClick, playSuccess } = useAppSound();
  const navigate = useNavigate();
  
  const [loadingCode, setLoadingCode] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [promotions, setPromotions] = useState<any[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [promoTab, setPromoTab] = useState<'active' | 'expired'>('active');
  const [selectedPlanModal, setSelectedPlanModal] = useState<any | null>(null);

  useBodyScrollLock(!!selectedPlanModal);

  const planBenefits: Record<string, string[]> = {
    'basic': [
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
    ],
    'pro': [
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
    ],
    'premium': [
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
    ],
    'ultra': [
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
  };

  const fetchPromos = () => {
    setLoadingPromos(true);
    fetch('/api/users/me/promotions')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setPromotions(data);
         setLoadingPromos(false);
      })
      .catch(() => setLoadingPromos(false));
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleCopyCode = () => {
    if (!user?.referral_code) return;
    playClick();
    navigator.clipboard.writeText(user.referral_code);
    setCopied(true);
    showNotification.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = () => {
    if (!user?.referral_code) return;
    playClick();
    const link = `${window.location.origin}/register?ref=${user.referral_code}`;
    if (navigator.share) {
      navigator.share({
        title: 'InstaBoost PRO',
        text: 'Entre no InstaBoost PRO usando meu código e ganhe moedas!',
        url: link,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', err);
        }
      });
    } else {
      navigator.clipboard.writeText(link);
      showNotification.success('Link copiado!');
    }
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCode) return;
    playClick();
    setLoadingCode(true);
    try {
      const res = await fetch('/api/me/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: friendCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        playSuccess();
        showNotification.success(data.message || 'Código resgatado!');
        await refreshUser();
        setFriendCode('');
      } else {
        showNotification.error(data.error || 'Código inválido');
      }
    } catch (err) {
      showNotification.error('Erro ao conectar.');
    } finally {
      setLoadingCode(false);
    }
  };

  const sendVerifyEmail = async () => {
    playClick();
    showNotification.info('Enviando código de verificação...');
    // Real implementation would call /api/me/email/verify/send
  };

  const plans = [
    { id: 'basic', name: 'BÁSICO', price: 'Gratuito' },
    { id: 'pro', name: 'PRO', price: 'R$ 50' },
    { id: 'premium', name: 'PREMIUM', price: 'R$ 100' },
    { id: 'ultra', name: 'ULTRA', price: 'R$ 150', featured: true }
  ];

  const userPlan = user?.plan_type || 'basic';

  return (
    <div className="max-w-4xl mx-auto space-y-10 mb-20">
      <GlobalLoader isLoading={loadingPromos} />
      
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center text-center space-y-4 pt-4"
      >
        <div className="relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-4xl sm:text-5xl font-black text-primary shadow-[0_0_30px_rgba(126,34,206,0.3)]">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className={`absolute -bottom-2 md:-bottom-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap shadow-lg border ${
            userPlan === 'pro' ? 'bg-green-500 text-black border-green-400' :
            userPlan === 'premium' ? 'bg-primary text-white border-primary-foreground/50' :
            userPlan === 'ultra' ? 'bg-amber-500 text-black border-amber-400' :
            'bg-secondary text-muted-foreground border-border'
          }`}>
            PLANO {userPlan.toUpperCase()}
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-black mt-2">@{user?.username}</h1>
          <div className="inline-flex items-center justify-center gap-2 mt-3 px-5 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-bold mx-auto">
            <AnimatedIcon type="coin" size={18} />
            {typeof user?.credits === 'number' ? user.credits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} Moedas
          </div>

          {user?.plan_expires_at && user.plan_type !== 'basic' && (
            <PlanCountdown expiresAt={user.plan_expires_at} />
          )}
        </div>
      </motion.div>

      {/* Planos de Assinatura */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-6 lg:p-8 relative overflow-hidden"
      >
        <div className="flex items-center gap-3 mb-6">
          <Diamond className="text-cyan-400" />
          <h2 className="text-xl font-bold">Planos de Assinatura</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {plans.map((p) => {
             const isActive = userPlan.toLowerCase() === p.id.toLowerCase();
             return (
              <div 
                key={p.id}
                onClick={() => { playClick(); setSelectedPlanModal(p); }}
                className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center relative overflow-hidden transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(126,34,206,0.15)]' 
                    : p.featured 
                      ? 'bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30' 
                      : 'bg-background/50 border-border/50 hover:bg-white/5'
                }`}
              >
                {p.featured && <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/20 rotate-45 translate-x-6 -translate-y-6" />}
                <span className={`text-[10px] font-bold tracking-widest uppercase ${p.id === 'pro' ? 'text-green-400' : p.id === 'premium' ? 'text-primary' : p.id === 'ultra' ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  {p.name}
                </span>
                <span className="text-lg font-bold">{p.price}</span>
                {isActive && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary mt-1">
                    Ativo
                  </span>
                )}
              </div>
             );
          })}
        </div>
        <Button variant="secondary" className="w-full mt-6 opacity-70 hover:opacity-100 transition-opacity" onClick={() => navigate('/store')}>Ver Benefícios e Comparar Planos</Button>
      </motion.div>

      {/* Indique e Ganhe! */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-gradient-to-b from-[#6322FA] to-[#4B11E0] rounded-[2.5rem] p-8 lg:p-12 text-white relative overflow-hidden shadow-2xl flex flex-col items-center mx-auto w-full"
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center text-center w-full">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
            <Users size={32} />
          </div>
          <h2 className="text-3xl font-black mb-4 tracking-tight">Indique e Ganhe!</h2>
          <p className="text-white/80 w-full max-w-sm mb-8 leading-relaxed">
            Convide seus amigos para o InstaBoost PRO e ganhe <strong className="text-yellow-400">
            {user?.plan_type === 'ultra' ? '2.000' : user?.plan_type === 'premium' ? '1.200' : user?.plan_type === 'pro' ? '800' : '500'} moedas
            </strong> quando eles entrarem, e <strong className="text-yellow-400">+
            {user?.plan_type === 'ultra' ? '50' : user?.plan_type === 'premium' ? '30' : user?.plan_type === 'pro' ? '20' : '10'}%
            </strong> de todas as moedas que eles ganharem!
          </p>

          <div className="w-full max-w-md space-y-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/20">
              <div className="flex flex-col items-start px-2">
                <span className="text-[10px] uppercase font-bold text-white/50 mb-1">Seu Código</span>
                <span className="text-2xl font-mono font-bold tracking-widest leading-none select-all">{user?.referral_code || '---'}</span>
              </div>
              <button onClick={handleCopyCode} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors active:scale-95">
                {copied ? <CheckCircle size={20} className="text-green-400" /> : <Copy size={20} />}
              </button>
            </div>
            
            <Button className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-lg" onClick={handleShareLink}>
              <Share2 className="mr-2" /> Link
            </Button>
          </div>

          <div className="w-full max-w-md mt-10 space-y-4 pt-10 border-t border-white/10">
             <p className="text-sm font-bold text-white/50 uppercase tracking-widest">Foi convidado por alguém?</p>
             <form onSubmit={handleClaimReferral} className="flex flex-col sm:flex-row gap-2">
                <Input 
                  value={friendCode}
                  onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO DO AMIGO" 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-14 font-mono font-bold tracking-widest rounded-2xl flex-1 text-center"
                />
                <Button type="submit" className="h-14 bg-white hover:bg-gray-100 text-[#5415EF] font-black rounded-2xl px-6 w-full sm:w-auto" isLoading={loadingCode}>
                   Resgatar
                </Button>
             </form>
          </div>
        </div>
      </motion.div>

      {/* Minhas Divulgações */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-card/40 backdrop-blur-xl border border-border rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 relative overflow-hidden shadow-xl"
      >
         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <History className="text-primary" size={20} />
               </div>
               <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Minhas Divulgações</h2>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-60">Gerencie seu engajamento</p>
               </div>
            </div>
            
            <div className="flex bg-background/50 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
               <button 
                  onClick={() => { playClick(); setPromoTab('active'); }}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${promoTab === 'active' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
               >
                  Ativas
               </button>
               <button 
                  onClick={() => { playClick(); setPromoTab('expired'); }}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${promoTab === 'expired' ? 'bg-destructive text-white shadow-lg shadow-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
               >
                  Expiradas
               </button>
            </div>
         </div>

         {/* Limits Display */}
         <div className="flex gap-4 mb-6">
            <div className={`flex-1 p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 ${promoTab === 'active' ? 'bg-primary/5 border-primary/20' : 'bg-background/20 border-border/20 opacity-50'}`}>
               <span className="text-[9px] uppercase font-black text-muted-foreground">Ativas</span>
               <span className="text-sm font-black">{promotions.filter(p => new Date(p.expires_at).getTime() > Date.now()).length} / {user?.plan_type === 'ultra' ? '∞' : user?.plan_type === 'premium' ? '50' : user?.plan_type === 'pro' ? '25' : '10'}</span>
            </div>
            <div className={`flex-1 p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 ${promoTab === 'expired' ? 'bg-destructive/5 border-destructive/20' : 'bg-background/20 border-border/20 opacity-50'}`}>
               <span className="text-[9px] uppercase font-black text-muted-foreground">Expiradas</span>
               <span className="text-sm font-black text-destructive">{promotions.filter(p => new Date(p.expires_at).getTime() < Date.now()).length} / ∞</span>
            </div>
         </div>
         
         <div className="min-h-[160px] flex flex-col">
            {loadingPromos ? (
              <div className="flex-1 flex items-center justify-center py-10">
                 <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
               <AnimatePresence mode="wait">
                  <motion.div
                    key={promoTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                     {(() => {
                        const filtered = promotions.filter(p => {
                           const isExpired = new Date(p.expires_at).getTime() < Date.now();
                           return promoTab === 'active' ? !isExpired : isExpired;
                        });

                        if (filtered.length === 0) {
                           return (
                              <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                                 <p className="text-muted-foreground text-sm font-medium mb-4">Nenhuma divulgação {promoTab === 'active' ? 'ativa' : 'expirada'} encontrada.</p>
                                 {promoTab === 'active' && (
                                    <Button variant="secondary" onClick={() => navigate('/new')} className="rounded-xl font-bold bg-background/50 hover:bg-background border px-6">
                                       Impulsionar Agora
                                    </Button>
                                 )}
                              </div>
                           );
                        }

                        return filtered.map((p: any) => (
                           <PromotionItem 
                              key={p.id} 
                              promo={p} 
                              onRefresh={fetchPromos} 
                              isExpired={promoTab === 'expired'}
                              playClick={playClick}
                              playSuccess={playSuccess}
                           />
                        ));
                     })()}
                  </motion.div>
               </AnimatePresence>
            )}

            {promoTab === 'active' && promotions.filter(p => new Date(p.expires_at).getTime() > Date.now()).length > 0 && (
               <Button variant="ghost" onClick={() => navigate('/new')} className="w-full mt-6 flex justify-center gap-2 text-primary font-bold opacity-80 hover:opacity-100 py-6 border border-dashed border-primary/20 rounded-2xl transition-all hover:bg-primary/5">
                  <PlusSquare size={18} /> Novo Impulsionamento
               </Button>
            )}
         </div>
      </motion.div>

      {/* Segurança e Recuperação */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-6 lg:p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="text-primary" />
          <h2 className="text-lg font-bold">Segurança e Recuperação</h2>
        </div>
        
        <div className="bg-background/40 border border-border/50 rounded-2xl p-6 space-y-4">
           <div>
             <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">E-mail Cadastrado</span>
             <span className="text-lg font-bold text-foreground block mb-2">{user?.email || 'Nenhum e-mail'}</span>
             <span className="text-xs font-bold text-orange-500/90 block">E-mail pendente de verificação</span>
           </div>
           
           <Button variant="secondary" onClick={sendVerifyEmail} className="w-full rounded-xl mt-4 font-bold bg-white/5 border border-white/5 hover:bg-white/10">
              Enviar Código de Verificação
           </Button>
        </div>
      </motion.div>

      {/* Configurações da Conta */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-6 lg:p-8"
      >
        <h2 className="text-lg font-bold mb-6">Configurações da Conta</h2>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 space-y-3 mb-6">
           <div className="flex gap-3 text-destructive">
             <AlertTriangle className="shrink-0 mt-0.5" size={20} />
             <div>
                <h3 className="font-bold mb-2">Política de Limpeza de Dados (Inatividade)</h3>
                <p className="text-sm opacity-90 leading-relaxed">
                   Para manter nossos servidores otimizados e seguros, contas inativas (sem nenhum acesso por mais de 90 dias) e publicações antigas expiradas a mais de 7 dias são <strong>excluídas permanentemente e sem aviso prévio.</strong> Todas as moedas e registros serão perdidos se a conta for apagada. Mantenha seu login ativo!
                </p>
             </div>
           </div>
        </div>

        <Button variant="destructive" className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg shadow-destructive/20" onClick={() => { playClick(); logout(); }}>
           <LogOut className="mr-2" /> Sair da conta
        </Button>
      </motion.div>

      <AnimatePresence>
        {selectedPlanModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden flex items-center justify-center p-4 custom-scrollbar">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedPlanModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-[2rem] p-8 border my-auto ${
                  selectedPlanModal.id === 'pro' ? 'bg-background/95 border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.1)]' :
                  selectedPlanModal.id === 'premium' ? 'bg-background/95 border-primary/50 shadow-[0_0_40px_rgba(126,34,206,0.1)]' :
                  selectedPlanModal.id === 'ultra' ? 'bg-background/95 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]' :
                  'bg-background/95 border-border shadow-xl'
              }`}
            >
              <button 
                onClick={() => setSelectedPlanModal(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <h3 className={`text-2xl font-black uppercase tracking-wider ${
                  selectedPlanModal.id === 'pro' ? 'text-green-400' :
                  selectedPlanModal.id === 'premium' ? 'text-primary' :
                  selectedPlanModal.id === 'ultra' ? 'text-amber-400' :
                  'text-muted-foreground'
                }`}>
                  Plano {selectedPlanModal.name}
                </h3>
                <p className="text-sm opacity-80 mt-2">Conheça todos os benefícios deste plano.</p>
              </div>

              <div className="space-y-4 mb-8">
                {planBenefits[selectedPlanModal.id]?.map((benefit: string, i: number) => {
                  let Icon = Check;
                  let iconColor = "text-green-500";
                  if (benefit.includes('x Moedas')) {
                      Icon = Zap;
                      iconColor = "text-yellow-500 fill-yellow-500/20";
                  } else if (benefit.includes('Prêmios Diários')) {
                      Icon = Gift;
                      iconColor = "text-purple-500";
                  } else if (benefit.includes('Jackpot') || benefit.includes('Roleta') || benefit.includes('Tickets')) {
                      Icon = Coins;
                      iconColor = "text-orange-500";
                  } else if (benefit.includes('Comissão')) {
                      Icon = Diamond;
                      iconColor = "text-cyan-400";
                  }
                  
                  return (
                  <div key={i} className="flex items-start gap-3">
                    <Icon size={18} className={`${iconColor} shrink-0 mt-0.5`} />
                    <span className="text-sm opacity-90 font-medium">{benefit}</span>
                  </div>
                )})}
              </div>

              <Button 
                onClick={() => {
                  setSelectedPlanModal(null);
                  navigate('/store');
                }}
                className={`w-full h-14 rounded-2xl text-lg font-bold ${
                  selectedPlanModal.id === 'pro' ? 'bg-green-500 hover:bg-green-600 text-black' :
                  selectedPlanModal.id === 'premium' ? 'bg-primary hover:bg-primary/90 text-white' :
                  selectedPlanModal.id === 'ultra' ? 'bg-amber-500 hover:bg-amber-600 text-black' :
                  'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {selectedPlanModal.id === 'basic' ? 'Ver na Loja' : 'Assinar Plano'}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
