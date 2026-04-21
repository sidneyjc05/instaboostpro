import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { LogOut, Rocket, Clock, History, AlertTriangle, RefreshCw, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reboostLoading, setReboostLoading] = useState<number | null>(null);
  const navigate = useNavigate();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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
      // Simplest interaction: reboost by 1 hour (60 minutes) which costs 300 credits
      const res = await fetch(`/api/promotions/${id}/reboost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 60 })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification.success('Divulgação reaplicada por +1 hora!');
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

  const calculateTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m restantes`;
    return `${minutes} minutos restantes`;
  };

  const calculatePaymentTimeLeft = (createdAt: string) => {
    // 15 mins total
    const diff = (new Date(createdAt).getTime() + 15 * 60 * 1000) - now;
    if (diff <= 0) return 'Cancelado (Expirado)';
    const minutes = Math.floor((diff / 1000) / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8 pb-20">
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
            {payments.map(pay => (
              <div key={pay.id} className="bg-secondary/40 p-4 rounded-2xl flex justify-between items-center border border-border">
                 <div className="flex flex-col">
                   <span className="font-bold">{pay.credits} Moedas</span>
                   <span className="text-xs text-muted-foreground mr-1 mt-1">Status: Aguardando Pagamento</span>
                 </div>
                 <div className="flex flex-col items-end">
                   <span className="font-mono text-destructive font-bold">{calculatePaymentTimeLeft(pay.created_at)}</span>
                   <span className="text-[10px] text-muted-foreground">Expira em breve</span>
                 </div>
              </div>
            ))}
            <Button variant="outline" className="w-full text-xs h-9 mt-1" onClick={() => navigate('/store')}>
              Ir para a Loja
            </Button>
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
                const msLeft = new Date(promo.expires_at).getTime() - now;
                // Allow reboost if expired or expiring within 1 hour
                const canReboost = isExpired || msLeft < 60 * 60 * 1000;
                
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
                         Reaplicar 1 Hora (300 💰)
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
