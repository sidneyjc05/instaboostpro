import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Mail, LogOut, Loader2, Diamond, Users, Copy, CheckCircle, Share2, AlertTriangle, ShieldCheck, History, PlusSquare, X, Check, Clock } from 'lucide-react';

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

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { playClick, playSuccess } = useAppSound();
  const navigate = useNavigate();
  
  const [loadingCode, setLoadingCode] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [promotions, setPromotions] = useState<any[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [selectedPlanModal, setSelectedPlanModal] = useState<any | null>(null);

  useBodyScrollLock(!!selectedPlanModal);

  const planBenefits: Record<string, string[]> = {
    'basic': [
      'Moedas normais em missões',
      'Chances normais na roleta',
      '1 publicação por dia',
      'Feed Geral',
      'Análise de desempenho básica'
    ],
    'pro': [
      'Dobro de moedas em todas as missões',
      '+20% chances na roleta',
      '10 publicações por dia',
      'Prioridade no Feed Geral',
      'Análise de desempenho básica',
      '+500 moedas de bônus mensal',
      '+10% de comissão extra'
    ],
    'premium': [
      'Triplo de moedas nas missões',
      '+50% chances na roleta',
      '30 publicações por dia',
      'Destaque no Feed Geral',
      'Análise de desempenho avançada',
      '+1500 moedas de bônus mensal',
      '+20% de comissão extra'
    ],
    'ultra': [
      'Quíntuplo de moedas nas missões',
      '+100% chances na roleta',
      'Publicações ilimitadas',
      'Top Destaque no Feed Geral',
      'Análise de desempenho premium',
      '+5000 moedas de bônus mensal',
      '+50% de comissão extra',
      'Suporte VIP'
    ]
  };

  useEffect(() => {
    fetch('/api/users/me/promotions')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setPromotions(data);
         setLoadingPromos(false);
      })
      .catch(() => setLoadingPromos(false));
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
            Convide seus amigos para o InstaBoost PRO e ganhe <strong className="text-yellow-400">500 moedas</strong> quando eles entrarem, e <strong className="text-yellow-400">+10%</strong> de todas as moedas que eles ganharem!
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
        className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-6 lg:p-8 relative overflow-hidden"
      >
         <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
               <History className="text-primary" />
               <h2 className="text-lg font-bold">Minhas Divulgações</h2>
            </div>
            <span className="text-xs font-bold bg-secondary/50 px-3 py-1 rounded-full">{promotions.length} / 10 Ativas</span>
         </div>
         
         <div className="min-h-[120px] flex flex-col items-center justify-center text-center gap-4 py-4">
            {loadingPromos ? (
              <Loader2 className="animate-spin text-primary" />
            ) : promotions.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">Você não tem nenhuma divulgação ativa no momento.</p>
                <Button variant="secondary" onClick={() => navigate('/new')} className="rounded-xl font-bold bg-background/50 hover:bg-background border">
                  Criar Divulgação
                </Button>
              </>
            ) : (
              <div className="w-full space-y-3">
                 {promotions.map(p => (
                    <div key={p.id} className="bg-background/50 border border-border/50 rounded-2xl p-4 flex justify-between items-center text-left">
                       <div>
                         <span className="text-xs font-bold text-primary mb-1 block uppercase">{p.type}</span>
                         <span className="text-sm font-medium opacity-80 max-w-[200px] truncate block">{p.url}</span>
                       </div>
                       <div className="text-right">
                         <span className="text-xl font-black">{Math.floor(p.progress)} <span className="opacity-50 text-sm">/ {p.goal}</span></span>
                       </div>
                    </div>
                 ))}
                 <Button variant="ghost" onClick={() => navigate('/new')} className="w-full mt-4 flex justify-center gap-2 text-primary opacity-80 hover:opacity-100">
                    <PlusSquare size={18} /> Adicionar Nova
                 </Button>
              </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedPlanModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-[2rem] p-8 border ${
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
                {planBenefits[selectedPlanModal.id]?.map((benefit: string, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm opacity-90 font-medium">{benefit}</span>
                  </div>
                ))}
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
