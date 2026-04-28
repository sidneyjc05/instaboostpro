import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { OTPInput } from '../components/ui/OTPInput';
import { showNotification } from '../context/NotificationContext';
import { LogOut, Rocket, Clock, History, AlertTriangle, RefreshCw, Eye, QrCode, Copy, X, Users, Share2, Award, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useAppSound } from '../context/SoundContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { playSuccess, playClick } = useAppSound();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reboostLoading, setReboostLoading] = useState<number | null>(null);
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<any>(null); // { qrCode, pixCode, etc }
  const [activePlanModal, setActivePlanModal] = useState<string | null>(null);
  const navigate = useNavigate();

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [showCommissions, setShowCommissions] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Lock scroll if any modal is open
  useBodyScrollLock(!!(activeQrModal || activePlanModal || showEmailVerify || showPasswordChange));

  const handleClaimReferral = async () => {
    if (!referralInput) return showNotification.error('Digite um código');
    setClaimLoading(true);
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'api/me/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralInput })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification.success(data.message);
        fetchData();
        refreshUser();
      } else {
        showNotification.error(data.error);
      }
    } catch {
       showNotification.error('Erro de conexão');
    }
    setClaimLoading(false);
  };

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLinkEmail = async () => {
     if (!emailInput) return showNotification.error('Digite um e-mail válido');
     setActionLoading(true);
     try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/me/email', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: emailInput })
        });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Email adicionado!');
           await refreshUser();
           handleSendVerifyCode();
        } else {
           showNotification.error(data.error);
        }
     } catch {
        showNotification.error('Erro de rede');
     }
     setActionLoading(false);
  };

  const handleSendVerifyCode = async () => {
     setActionLoading(true);
     try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/me/email/verify/send', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
           if (data.bypassed) {
              showNotification.success(`E-mail verificado automaticamente. Código bypass: ${data.code}`);
              await refreshUser();
           } else {
              showNotification.success('Código enviado para seu e-mail!');
              setShowEmailVerify(true);
           }
        } else {
           showNotification.error(data.error);
        }
     } catch {
        showNotification.error('Erro ao enviar código');
     }
     setActionLoading(false);
  };

  const handleVerifyEmail = async () => {
     if (!codeInput) return;
     setActionLoading(true);
     try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/me/email/verify', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ code: codeInput })
        });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Email verificado com sucesso!');
           setShowEmailVerify(false);
           setCodeInput('');
           await refreshUser();
        } else {
           showNotification.error(data.error);
        }
     } catch {
        showNotification.error('Erro ao verificar código');
     }
     setActionLoading(false);
  };

  const handleChangePassword = async () => {
     setActionLoading(true);
     try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/auth/recover/send', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: user?.email })
        });
        const data = await res.json();
        if (res.ok) {
           if (data.bypassed) {
              showNotification.success(`Aviso: Email bypass ativado. Use este código para trocar a senha: ${data.code}`);
           } else {
              showNotification.success('Código de segurança enviado para seu email!');
           }
           setShowPasswordChange(true);
        } else {
           showNotification.error(data.error);
        }
     } catch {
        showNotification.error('Erro ao enviar código');
     }
     setActionLoading(false);
  };

  const handleUpdatePassword = async () => {
     if (!codeInput || !passwordInput) return showNotification.error('Preencha os campos');
     setActionLoading(true);
     try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/auth/recover/reset', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: user?.email, code: codeInput, newPassword: passwordInput })
        });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Senha atualizada com sucesso!');
           setShowPasswordChange(false);
           setCodeInput('');
           setPasswordInput('');
        } else {
           showNotification.error(data.error);
        }
     } catch {
        showNotification.error('Erro ao verificar código');
     }
     setActionLoading(false);
  };

  // Sync payments automatically while the QR modal is open
  useEffect(() => {
    let interval: any;
    if (activeQrModal?.id) {
       interval = setInterval(async () => {
          try {
             const res = await fetch(`$\{import.meta.env.BASE_URL\}api/payments/${activeQrModal.id}`);
             if (res.ok) {
                const data = await res.json();
                if (data.status === 'approved') {
                   setActiveQrModal(null);
                   playSuccess();
                   showNotification.success('Pagamento Aprovado!');
                   fetchData();
                   refreshUser();
                }
             }
          } catch(e) {}
       }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeQrModal]);

  const fetchData = async () => {
    try {
      const [promoRes, payRes, refRes] = await Promise.all([
        fetch(import.meta.env.BASE_URL + 'api/users/me/promotions'),
        fetch(import.meta.env.BASE_URL + 'api/users/me/payments'),
        fetch(import.meta.env.BASE_URL + 'api/me/referral')
      ]);
      if (promoRes.ok) setPromotions(await promoRes.json());
      if (payRes.ok) setPayments(await payRes.json());
      if (refRes.ok) setReferral(await refRes.json());
    } catch {}
    setLoading(false);
  };

  const handleReboost = async (id: number) => {
    setReboostLoading(id);
    try {
      const res = await fetch(`$\{import.meta.env.BASE_URL\}api/promotions/${id}/reboost`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showNotification.success('Divulgação reaplicada com sucesso!');
        fetchData();
        refreshUser();
      } else {
        showNotification.error(data.error || 'Erro ao reaplicar');
      }
    } catch {
       showNotification.error('Erro de conexão');
    }
    setReboostLoading(null);
  };

  const handleViewPix = async (payId: string) => {
     setCheckingPayment(payId);
     try {
       const res = await fetch(`$\{import.meta.env.BASE_URL\}api/payments/${payId}`);
       const data = await res.json();
       if (res.ok && data.qrCode) {
          setActiveQrModal(data);
       } else if (data.status === 'approved') {
          showNotification.success('Esse pagamento já foi aprovado!');
          fetchData();
       } else {
          showNotification.error('Não foi possível carregar o código PIX.');
       }
     } catch {
       showNotification.error('Erro ao conectar ao servidor.');
     }
     setCheckingPayment(null);
  };

  const calculateTimeLeft = (expiresAt: string) => {
    const safeDateStr = expiresAt.includes('Z') ? expiresAt : expiresAt.replace(' ', 'T') + 'Z';
    const diff = new Date(safeDateStr).getTime() - now;
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m restantes`;
    if (minutes > 0) return `${minutes}m ${seconds}s restantes`;
    return `${seconds} segundos restantes`;
  };

  const calculatePaymentTimeLeft = (createdAt: string) => {
    // 15 mins total
    const safeDateStr = createdAt.includes('Z') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
    const diff = (new Date(safeDateStr).getTime() + 15 * 60 * 1000) - now;
    if (diff <= 0) return 'Cancelado (Expirado)';
    const minutes = Math.floor((diff / 1000) / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (cost: number) => {
     const mins = cost / 5;
     if (mins >= 60) {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
     }
     return `${mins}m`;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-3xl mx-auto w-full">
      
      <AnimatePresence>
         {activePlanModal && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
               onClick={() => setActivePlanModal(null)}
            >
               <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className={`bg-card w-full max-w-sm border shadow-2xl rounded-3xl p-6 flex flex-col gap-4 relative ${
                     activePlanModal === 'pro' ? 'border-green-500/50 shadow-green-500/10' :
                     activePlanModal === 'premium' ? 'border-purple-500/50 shadow-purple-500/10' :
                     'border-yellow-500/50 shadow-yellow-500/10'
                  }`}
                  onClick={(e) => e.stopPropagation()}
               >
                  <button onClick={() => { playClick(); setActivePlanModal(null); }} className="absolute top-4 right-4 p-2 bg-secondary rounded-full hover:bg-secondary/80">
                    <X size={20} />
                  </button>

                  <div className="text-center">
                    <h3 className={`text-2xl font-black uppercase ${
                       activePlanModal === 'pro' ? 'text-green-500' :
                       activePlanModal === 'premium' ? 'text-purple-500' :
                       'text-yellow-500'
                    }`}>
                       Plano {activePlanModal}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Conheça todos os benefícios deste plano.</p>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 mt-2 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
                     {(activePlanModal === 'pro' ? [
                        'Dobro de moedas em todas as missões',
                        '+20% chances na roleta',
                        '10 publicações por dia',
                        'Prioridade no Feed Geral',
                        'Análise de desempenho básica',
                        '+500 moedas de bônus mensal',
                        '+10% de comissão extra'
                     ] : activePlanModal === 'premium' ? [
                        'Dobro de moedas nas missões',
                        '+40% chances na roleta',
                        '15 publicações por dia (24h limite)',
                        '+4 tickets de roleta diários',
                        'Stories com duração +24h',
                        'Análise de desempenho avançada',
                        'Redução de cooldown em missões',
                        'Remoção de anúncios / Ultra clean',
                        '+1.500 moedas de bônus mensal',
                        '+20% de comissão extra'
                     ] : [
                        'Dobro + 50% extra de moedas',
                        '+80% chances na roleta',
                        '30 publicações por dia (48h limite)',
                        '+8 tickets de roleta diários',
                        'Stories com duração +48h',
                        'Suporte VIP 24h',
                        'Maior prioridade no Feed Geral',
                        'Acesso Beta a novos recursos',
                        'Remoção de anúncios / Ultra clean',
                        '+4.000 moedas de bônus mensal',
                        '+40% de comissão extra'
                     ]).map((b, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                           <CheckCircle className={`shrink-0 mt-0.5 ${
                               activePlanModal === 'pro' ? 'text-green-500' :
                               activePlanModal === 'premium' ? 'text-purple-500' :
                               'text-yellow-500'
                           }`} size={16} />
                           <span className="leading-tight">{b}</span>
                        </div>
                     ))}
                  </div>

                  <Button 
                     className="w-full mt-2" 
                     onClick={() => {
                        playClick();
                        navigate(`/store?tab=plans`);
                     }}
                  >
                     Assinar Plano
                  </Button>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {activeQrModal && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
            >
               <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-card w-full max-w-sm border border-border shadow-2xl rounded-3xl p-6 flex flex-col items-center gap-6 relative"
               >
                  <button onClick={() => setActiveQrModal(null)} className="absolute top-4 right-4 p-2 bg-secondary rounded-full hover:bg-secondary/80">
                     <X size={20} />
                  </button>
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                    <QrCode size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold">Pagar via PIX</h3>
                    <p className="text-sm text-muted-foreground mt-1">Escaneie o código para aprovação imediata.</p>
                  </div>
                  
                  <div className="p-2 bg-white rounded-xl">
                    <img src={activeQrModal.qrCode} alt="PIX QR Code" className="w-48 h-48" />
                  </div>
                  
                  <div className="w-full flex gap-2">
                    <div className="flex-1 bg-secondary rounded-xl px-3 py-2 text-xs truncate border border-border flex items-center text-left">
                      {activeQrModal.pixCode?.substring(0, 30)}...
                    </div>
                    <Button 
                       variant="outline"
                       onClick={() => {
                         navigator.clipboard.writeText(activeQrModal.pixCode);
                         showNotification.success('Código PIX copiado!');
                       }}
                    >
                      <Copy size={16} /> Copiar
                    </Button>
                  </div>

                  <div className="text-sm text-primary font-mono animate-pulse">
                     Aguardando confirmação...
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Profile Header */}
      <div className="flex flex-col items-center text-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4 ring-4 ${user.plan_type === 'ultra' ? 'bg-gradient-to-tr from-yellow-500 to-orange-600 ring-yellow-500/50 shadow-yellow-500/50' : user.plan_type === 'premium' ? 'bg-gradient-to-tr from-purple-500 to-pink-500 ring-purple-500/50 shadow-purple-500/50' : user.plan_type === 'pro' ? 'bg-gradient-to-tr from-green-500 to-teal-500 ring-green-500/50 shadow-green-500/50' : 'bg-gradient-to-tr from-gray-700 to-gray-500 ring-border'}`}>
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
           @{user.username}
           {user.plan_type === 'ultra' && <span className="text-yellow-500" title="Plano Ultra">💎</span>}
           {user.plan_type === 'premium' && <span className="text-purple-500" title="Plano Premium">✨</span>}
           {user.plan_type === 'pro' && <span className="text-green-500" title="Plano Pro">⚡</span>}
        </h2>
        
        {user.plan_type !== 'basic' && user.plan_expires_at && (
           <div className="text-xs text-muted-foreground mt-1">
              Plano {user.plan_type.toUpperCase()} ativo até {new Date(user.plan_expires_at).toLocaleDateString('pt-BR')}
           </div>
        )}

        <div className="mt-4 px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2">
          <span>💰</span>
          <span>{Number((user.credits || 0).toFixed(1))} Moedas</span>
        </div>
      </div>

      {/* Planos Disponiveis Section */}
      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 flex flex-col gap-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
             <h3 className="font-bold flex items-center gap-2 text-primary">
                💎 Planos de Assinatura
             </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <div className="bg-secondary/50 border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                <span className="font-bold uppercase text-muted-foreground text-xs">Básico</span>
                <span className="font-bold text-foreground">Gratuito</span>
                {user.plan_type === 'basic' ? (
                   <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-full mt-1">ATIVO</span>
                ) : null}
             </div>
             
             <div onClick={() => { playClick(); setActivePlanModal('pro'); }} className="cursor-pointer hover:ring-2 ring-green-500/50 transition-all bg-gradient-to-br from-green-500/10 to-green-900/10 border border-green-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                <span className="font-bold uppercase text-green-500 text-xs">Pro</span>
                <span className="font-bold text-foreground">R$ 50</span>
                {user.plan_type === 'pro' ? <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-full mt-1">ATIVO</span> : null}
             </div>
             
             <div onClick={() => { playClick(); setActivePlanModal('premium'); }} className="cursor-pointer hover:ring-2 ring-purple-500/50 transition-all bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                <span className="font-bold uppercase text-purple-500 text-xs">Premium</span>
                <span className="font-bold text-foreground">R$ 100</span>
                {user.plan_type === 'premium' ? <span className="text-[10px] text-purple-500 font-bold bg-purple-500/10 px-2 py-1 rounded-full mt-1">ATIVO</span> : null}
             </div>

             <div onClick={() => { playClick(); setActivePlanModal('ultra'); }} className="cursor-pointer hover:ring-2 ring-yellow-500/50 transition-all bg-gradient-to-br from-yellow-400/10 to-orange-600/10 border border-yellow-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-500/20 rotate-45 transform translate-x-2 -translate-y-2" />
                <span className="font-bold uppercase text-yellow-500 text-xs">Ultra</span>
                <span className="font-bold text-foreground">R$ 150</span>
                {user.plan_type === 'ultra' ? <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/10 px-2 py-1 rounded-full mt-1">ATIVO</span> : null}
             </div>
          </div>
          
          <Button variant="outline" className="w-full mt-2" onClick={() => { playClick(); navigate('/store?tab=plans'); }}>
             Ver Benefícios e Comparar Planos
          </Button>
      </div>

      {/* Indique e Ganhe Section */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-500 rounded-3xl p-1 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
         <div className="bg-card w-full h-full rounded-[20px] p-5 md:p-6 flex flex-col items-center text-center relative z-10">
            <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/30">
               <Users size={32} />
            </div>
            <h3 className="text-2xl font-extrabold font-space bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse">
               Indique e Ganhe!
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
               Convide seus amigos para o InstaBoost PRO e ganhe <strong className="text-yellow-400">500 moedas</strong> quando eles entrarem, e <strong className="text-primary">+10%</strong> de todas as moedas que eles ganharem!
            </p>

            {referral ? (
               <div className="w-full flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                     <div className="flex-1 bg-secondary border border-border rounded-xl flex items-center justify-between px-4 py-3 relative overflow-hidden group">
                        <div className="flex flex-col items-start z-10 w-full">
                           <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Seu Código</span>
                           <span className="font-mono text-xl text-white font-bold tracking-widest">{referral.referral_code}</span>
                        </div>
                        <Button 
                           variant="outline" 
                           size="icon" 
                           className="bg-transparent border-none text-muted-foreground hover:text-white shrink-0 z-10"
                           onClick={() => {
                              navigator.clipboard.writeText(referral.referral_code);
                              showNotification.success('Código copiado!');
                           }}
                        >
                           <Copy size={18} />
                        </Button>
                     </div>
                     <Button 
                        className="bg-primary hover:bg-primary/90 text-white shadow-lg h-[74px] sm:w-[120px]"
                        onClick={() => {
                           const link = `${window.location.origin}/indicar?ref=${referral.referral_code}`;
                           navigator.clipboard.writeText(link);
                           showNotification.success('Link copiado!');
                        }}
                     >
                        <Share2 size={20} className="mr-2" /> Link
                     </Button>
                  </div>

                  {/* Ativar codigo received */}
                  {!referral.referred_by && (
                     <div className="mt-4 border-t border-border/50 pt-4">
                        <p className="text-xs text-muted-foreground mb-3 font-semibold">Foi convidado por alguém?</p>
                        <div className="flex gap-2">
                           <Input 
                              placeholder="Código do amigo" 
                              value={referralInput}
                              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                              className="font-mono text-center tracking-widest uppercase"
                           />
                           <Button variant="outline" onClick={handleClaimReferral} isLoading={claimLoading}>
                              Resgatar
                           </Button>
                        </div>
                     </div>
                  )}

                  {/* Commissions Button */}
                  {referral.referred_users?.length > 0 && (
                     <div className="w-full mt-2">
                        <Button
                           variant="outline"
                           className="w-full bg-secondary/30 flex justify-between items-center"
                           onClick={() => setShowCommissions(!showCommissions)}
                        >
                           <span className="flex items-center gap-2">
                              <Award size={16} className="text-yellow-500" />
                              <span className="font-bold">Comissões ({referral.total_earnings?.toFixed(0)}💰)</span>
                           </span>
                           {showCommissions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>

                        <AnimatePresence>
                           {showCommissions && (
                              <motion.div
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 className="overflow-hidden w-full mt-2 flex flex-col gap-2"
                              >
                                 <div className="bg-secondary/50 rounded-2xl p-4 border border-border text-left">
                                    <p className="text-sm font-bold text-muted-foreground uppercase mb-4 tracking-wider">Amigos Indicados ({referral.referred_users.length})</p>
                                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                                       {referral.referred_users.map((ru: any, i: number) => {
                                          let statusColor = 'bg-red-500 hover:bg-red-400';
                                          let statusText = 'Inativo há muito tempo';
                                          let activePercent = 10;
                                          
                                          if (ru.last_active_at) {
                                            const activeDate = new Date(ru.last_active_at);
                                            const daysDiff = Math.floor((Date.now() - activeDate.getTime()) / (1000 * 60 * 60 * 24));
                                            if (daysDiff <= 1) {
                                              statusColor = 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
                                              statusText = 'Ativo (Hoje)';
                                              activePercent = 95;
                                            } else if (daysDiff <= 3) {
                                              statusColor = 'bg-green-500';
                                              statusText = 'Ativo recentemente';
                                              activePercent = 70;
                                            } else if (daysDiff <= 7) {
                                              statusColor = 'bg-yellow-500';
                                              statusText = `Pouco ativo (${daysDiff}d atrás)`;
                                              activePercent = 40;
                                            } else {
                                              statusColor = 'bg-red-500';
                                              statusText = `Inativo há ${daysDiff} dias`;
                                              activePercent = 10;
                                            }
                                          }

                                          return (
                                          <div key={i} className="flex flex-col gap-2 bg-card p-3 rounded-xl border border-border/60 hover:border-primary/30 transition-colors shadow-sm">
                                             <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                   <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/80 to-blue-500/80 text-white flex items-center justify-center text-lg font-bold shadow-md relative">
                                                      {ru.username.substring(0,2).toUpperCase()}
                                                      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${statusColor}`} />
                                                   </div>
                                                   <div className="flex flex-col">
                                                      <span className="text-sm font-extrabold text-foreground">@{ru.username}</span>
                                                      <span className="text-[10px] text-muted-foreground/80 my-0.5">{statusText}</span>
                                                      <div className="w-20 h-1 mt-1 bg-secondary rounded-full overflow-hidden">
                                                        <div className={`h-full ${statusColor.split(' ')[0]} rounded-full transition-all`} style={{ width: `${activePercent}%` }} />
                                                      </div>
                                                   </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                   <span className="text-xs font-semibold text-muted-foreground uppercase opacity-80 mb-1">Ganhos</span>
                                                   <span className="text-lg font-black text-yellow-500 flex items-center gap-1"><Award size={14}/> {ru.total_earned?.toFixed(1) || 0}</span>
                                                </div>
                                             </div>
                                          </div>
                                       )})}
                                    </div>
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  )}
               </div>
            ) : (
               <div className="animate-pulse w-full h-[100px] bg-secondary/50 rounded-xl" />
            )}
         </div>
      </div>

      {payments.length > 0 && (
        <div className="bg-card w-full border border-border rounded-3xl p-5 md:p-6 flex flex-col gap-4">
          <h3 className="font-bold border-b border-border pb-3 flex items-center gap-2">
            <Clock size={18} className="text-orange-500" /> Pagamentos PIX Pendentes
          </h3>
          <div className="flex flex-col gap-3">
            {payments.map(pay => {
              const timeLeft = calculatePaymentTimeLeft(pay.created_at);
              const isExpired = timeLeft.includes('Cancelado');

              return (
                <div key={pay.id} className="bg-secondary/40 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center border border-border gap-3">
                   <div className="flex flex-col w-full">
                     <span className="font-bold">{pay.credits} Moedas</span>
                     <div className="flex justify-between w-full mt-1">
                       <span className="text-xs text-muted-foreground mr-1">Status: Aguardando Pagamento</span>
                       <div className="flex flex-col items-end">
                         <span className={`font-mono font-bold ${isExpired ? 'text-muted-foreground' : 'text-destructive'}`}>{timeLeft}</span>
                       </div>
                     </div>
                     {!isExpired && (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="mt-3 w-full"
                          isLoading={checkingPayment === pay.id}
                          onClick={() => handleViewPix(pay.id)}
                        >
                          <QrCode size={16} className="mr-2" /> Pagar Agora
                        </Button>
                     )}
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 flex flex-col gap-4">
        <div className="border-b border-border pb-3 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2 text-primary">
            <History size={18} /> Minhas Divulgações
          </h3>
          <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md">
            {promotions.filter(p => calculateTimeLeft(p.expires_at) !== 'Expirado').length} / 10 Ativas
          </span>
        </div>
        
        {loading ? (
           <div className="text-center text-muted-foreground py-4 text-sm animate-pulse">Carregando...</div>
        ) : promotions.length === 0 ? (
           <div className="text-center text-muted-foreground py-6 text-sm bg-secondary/30 rounded-2xl">
             Você não tem nenhuma divulgação ativa no momento.<br/>
             <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/new')}>Criar Divulgação</Button>
           </div>
        ) : (
           <div className="flex flex-col gap-4">
              {promotions.map(promo => {
                const timeLeft = calculateTimeLeft(promo.expires_at);
                const isExpired = timeLeft === 'Expirado';
                const safeDateStr = promo.expires_at.includes('Z') ? promo.expires_at : promo.expires_at.replace(' ', 'T') + 'Z';
                const msLeft = new Date(safeDateStr).getTime() - now;
                // Allow reboost if expired or expiring within 1 hour
                const canReboost = isExpired || msLeft < 60 * 60 * 1000;
                const durText = formatDuration(promo.cost);
                
                return (
                  <div key={promo.id} className={`p-4 rounded-2xl border flex flex-col gap-3 ${isExpired ? 'bg-secondary/20 border-border opacity-70' : 'bg-primary/5 border-primary/20'}`}>
                    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                       <a href={promo.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-500 hover:underline flex items-center gap-1 truncate max-w-[200px]">
                         <Eye size={14} /> Link da publicação
                       </a>
                       <span className={`text-xs font-bold px-2 py-1 rounded-md ${isExpired ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                         {isExpired ? 'Expirado' : 'Ativo'}
                       </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-muted-foreground">Tempo Restante:</span>
                       <span className="font-mono font-medium">{timeLeft}</span>
                    </div>
                    
                    {canReboost && (
                       <Button 
                         variant="primary" 
                         size="sm" 
                         className="w-full mt-2 flex items-center gap-2 bg-gradient-to-r from-primary to-purple-600 border-none text-white"
                         disabled={reboostLoading === promo.id}
                         onClick={() => handleReboost(promo.id)}
                       >
                         {reboostLoading === promo.id ? <RefreshCw className="animate-spin" size={14} /> : <Rocket size={14} />}
                         Reaplicar {durText} ({promo.cost} 💰)
                       </Button>
                    )}
                  </div>
                )
              })}
           </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 flex flex-col gap-4">
        <h3 className="font-bold border-b border-border pb-3 flex items-center gap-2">
           Segurança e Recuperação
        </h3>
        
        <div className="flex flex-col gap-3">
           <div className="p-4 bg-secondary/30 rounded-2xl flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                 <span className="text-sm text-muted-foreground">E-mail Cadastrado</span>
                 <span className="font-bold">{user.email ? user.email : 'Nenhum e-mail vinculado'}</span>
                 {!user.is_verified && user.email && (
                    <span className="text-xs text-orange-500 font-bold mb-2">E-mail pendente de verificação</span>
                 )}
                 {user.is_verified && (
                    <span className="text-xs text-green-500 font-bold">Verificado ✓</span>
                 )}
              </div>

              {!user.is_verified && (
                 <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border/50">
                    {!user.email && (
                       <div className="flex gap-2">
                          <Input 
                             placeholder="Seu melhor e-mail" 
                             value={emailInput} 
                             onChange={(e) => setEmailInput(e.target.value)} 
                          />
                          <Button variant="primary" onClick={handleLinkEmail} isLoading={actionLoading}>
                             Vincular
                          </Button>
                       </div>
                    )}
                    
                    {user.email && !showEmailVerify && (
                       <Button variant="outline" onClick={handleSendVerifyCode} isLoading={actionLoading}>
                          Enviar Código de Verificação
                       </Button>
                    )}

                    {showEmailVerify && (
                       <div className="flex flex-col gap-2 p-3 bg-card border border-border shadow-sm rounded-xl">
                          <p className="text-xs font-bold text-center">Digite o código recebido</p>
                           <div className="flex flex-col gap-4 mt-2">
                              <OTPInput value={codeInput} onChange={setCodeInput} />
                              <Button variant="primary" onClick={handleVerifyEmail} isLoading={actionLoading} className="w-full">Validar</Button>
                           </div>
                          <button onClick={() => setShowEmailVerify(false)} className="text-xs text-muted-foreground mt-1 hover:underline">
                             Cancelar
                          </button>
                       </div>
                    )}
                 </div>
              )}
           </div>

           {user.email && user.is_verified && (
               <div className="p-4 bg-secondary/30 rounded-2xl flex flex-col gap-3 mt-4">
                  <div className="flex flex-col gap-1">
                     <span className="text-sm text-muted-foreground">Senha</span>
                     <span className="font-bold">********</span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border/50">
                     {!showPasswordChange ? (
                        <Button variant="outline" onClick={handleChangePassword} isLoading={actionLoading}>
                           Trocar Senha
                        </Button>
                     ) : (
                        <div className="flex flex-col gap-4 p-4 bg-card border border-border shadow-sm rounded-xl">
                           <p className="text-xs font-bold text-center">Enviamos um código para seu e-mail.</p>
                           <OTPInput value={codeInput} onChange={setCodeInput} />
                           <Input type="password" placeholder="Nova Senha" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                           <Button variant="primary" onClick={handleUpdatePassword} isLoading={actionLoading}>Atualizar Senha</Button>
                           <button onClick={() => setShowPasswordChange(false)} className="text-xs text-muted-foreground mt-1 hover:underline">Cancelar</button>
                        </div>
                     )}
                  </div>
               </div>
            )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 flex flex-col gap-4">
        <h3 className="font-bold border-b border-border pb-3 flex items-center gap-2">
           Configurações da Conta
        </h3>
        
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 mt-2">
           <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
           <div className="flex flex-col gap-2 text-sm text-red-900/90 dark:text-red-200/90">
             <p className="font-bold">Política de Limpeza de Dados (Inatividade)</p>
             <p>Para manter nossos servidores otimizados e seguros, contas inativas (sem nenhum acesso por mais de 90 dias) e publicações antigas expiradas a mais de 7 dias são <strong>excluídas permanentemente e sem aviso prévio</strong>. Todas as moedas e registros serão perdidos se a conta for apagada. Mantenha seu login ativo!</p>
           </div>
        </div>

        <Button variant="destructive" className="flex items-center gap-2 w-full mt-4" onClick={logout}>
          <LogOut size={18} /> Sair da conta
        </Button>
      </div>
    </div>
  );
}
