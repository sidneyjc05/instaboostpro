import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { OTPInput } from '../components/ui/OTPInput';
import { showNotification } from '../context/NotificationContext';
import { LogOut, Rocket, Clock, History, AlertTriangle, RefreshCw, Eye, QrCode, Copy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reboostLoading, setReboostLoading] = useState<number | null>(null);
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<any>(null); // { qrCode, pixCode, etc }
  const navigate = useNavigate();

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
        const res = await fetch('/api/me/email', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: emailInput })
        });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Email adicionado! Enviaremos um código.');
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
        const res = await fetch('/api/me/email/verify/send', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Código enviado para seu e-mail!');
           setShowEmailVerify(true);
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
        const res = await fetch('/api/me/email/verify', {
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
        const res = await fetch('/api/auth/recover/send', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: user?.email })
        });
        const data = await res.json();
        if (res.ok) {
           showNotification.success('Código de segurança enviado para seu email!');
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
        const res = await fetch('/api/auth/recover/reset', {
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
             const res = await fetch(`/api/payments/${activeQrModal.id}`);
             if (res.ok) {
                const data = await res.json();
                if (data.status === 'approved') {
                   setActiveQrModal(null);
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
      const [promoRes, payRes] = await Promise.all([
        fetch('/api/users/me/promotions'),
        fetch('/api/users/me/payments')
      ]);
      if (promoRes.ok) setPromotions(await promoRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } catch {}
    setLoading(false);
  };

  const handleReboost = async (id: number) => {
    setReboostLoading(id);
    try {
      const res = await fetch(`/api/promotions/${id}/reboost`, {
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
       const res = await fetch(`/api/payments/${payId}`);
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
    if (hours > 0) return `${hours}h ${minutes}m restantes`;
    return `${minutes} minutos restantes`;
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
    <div className="flex flex-col gap-8 pb-20">
      
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

      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold">@{user.username}</h2>
        <div className="mt-4 px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2">
          <span>💎</span>
          <span>{Number((user.credits || 0).toFixed(1))} Moedas</span>
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
        <h3 className="font-bold border-b border-border pb-3 flex items-center gap-2 text-primary">
          <History size={18} /> Minhas Divulgações
        </h3>
        
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
