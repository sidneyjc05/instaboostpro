import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Zap, 
  ShieldCheck, 
  Coins, 
  Ticket, 
  Sparkles, 
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { AnimatedIcon } from './AnimatedIcon';
import { showNotification } from '../context/NotificationContext';
import { useAppSound } from '../context/SoundContext';
import { useNavigate } from 'react-router';
import confetti from 'canvas-confetti';

interface PaymentRecord {
  id: string;
  userId?: string;
  user_id?: string | number;
  item_type?: 'coins' | 'tickets' | 'plan';
  itemType?: 'coins' | 'tickets' | 'plan';
  amount?: number;
  plan_id?: string;
  planId?: string;
  price?: number;
  method?: string;
  status: 'pending' | 'in_queue' | 'approved' | 'delivered' | 'rejected' | string;
  delivered?: boolean;
  verificationToken?: string;
  verification_token?: string;
  queuePosition?: number;
  created_at?: string;
  createdAt?: any;
}

export function UserPaymentsSection() {
  const { user, refreshUser } = useAuth();
  const { playClick, playSuccess } = useAppSound();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [allPendingCount, setAllPendingCount] = useState<number>(0);
  const [allPendingList, setAllPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'delivered'>('all');

  // Real-time listener for user payments + all pending queue from Firestore
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to user payments
    const userPaymentsQuery = query(
      collection(db, 'payments'),
      where('userId', '==', user.id)
    );

    const unsubscribeUser = onSnapshot(userPaymentsQuery, (snapshot) => {
      const userDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentRecord[];

      // Sort by creation time descending
      userDocs.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setPayments(userDocs);
      setLoading(false);
    }, (err) => {
      console.warn("Error listening to user payments:", err);
      // Fallback to API
      fetch(`/api/payments/my`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setPayments(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });

    // Listen to all pending payments to calculate real-time queue position
    const pendingQuery = query(
      collection(db, 'payments'),
      where('status', 'in', ['pending', 'in_queue'])
    );

    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const pendingDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort oldest first for queue calculation
      pendingDocs.sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
        return timeA - timeB;
      });

      setAllPendingCount(pendingDocs.length);
      setAllPendingList(pendingDocs);
    }, () => {});

    return () => {
      unsubscribeUser();
      unsubscribePending();
    };
  }, [user?.id]);

  const handleCopyToken = (token: string) => {
    playClick();
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    showNotification.success('Token de verificação copiado!');
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleVerifyNow = async (payment: PaymentRecord) => {
    playClick();
    const token = payment.verificationToken || payment.verification_token;
    if (!token) {
      showNotification.error('Token não encontrado neste pedido.');
      return;
    }

    setValidatingId(payment.id);
    try {
      // Direct call to verify endpoint
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          paymentId: payment.id,
          userId: user?.id,
          itemType: payment.itemType || payment.item_type,
          amount: payment.amount,
          planId: payment.planId || payment.plan_id
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        playSuccess();
        showNotification.success(data.message || 'Pagamento confirmado e liberado com sucesso!');
        await refreshUser();
      } else {
        showNotification.info(data.message || 'Pagamento ainda em validação pelo banco. Aguarde alguns instantes.');
      }
    } catch (err: any) {
      showNotification.error('Erro na conexão com a rede de pagamentos. Tente novamente.');
    } finally {
      setValidatingId(null);
    }
  };

  // Cooldown countdown timer component for pending items
  const PaymentCountdown = ({ createdAt }: { createdAt?: string }) => {
    const [timeLeftStr, setTimeLeftStr] = useState<string>('30:00');
    const [percent, setPercent] = useState<number>(100);

    useEffect(() => {
      const startTime = createdAt ? new Date(createdAt).getTime() : Date.now();
      const totalCooldownMs = 30 * 60 * 1000; // 30 minutes
      const endTime = startTime + totalCooldownMs;

      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        
        const calculatedPercent = Math.max(0, Math.min(100, (remaining / totalCooldownMs) * 100));
        setPercent(calculatedPercent);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }, [createdAt]);

    return (
      <div className="w-full bg-background/50 border border-border/60 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-amber-400">
            <Clock size={14} className="animate-spin text-amber-400" />
            Auto-Liberação em Alta Demanda
          </span>
          <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            {timeLeftStr}
          </span>
        </div>
        <div className="w-full bg-secondary/60 h-2 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
            style={{ width: `${100 - percent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Seu pedido é processado automaticamente e liberado na sua conta.
        </p>
      </div>
    );
  };

  const filteredPayments = payments.filter(p => {
    const isDelivered = p.status === 'delivered' || p.status === 'approved' || p.delivered;
    if (activeTab === 'pending') return !isDelivered;
    if (activeTab === 'delivered') return isDelivered;
    return true;
  });

  const pendingCount = payments.filter(p => p.status === 'pending' || p.status === 'in_queue' || (!p.delivered && p.status !== 'approved')).length;
  const deliveredCount = payments.filter(p => p.status === 'delivered' || p.status === 'approved' || p.delivered).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="bg-card/40 backdrop-blur-xl border border-border rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 relative overflow-hidden shadow-xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 text-primary shadow-lg shadow-primary/10">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              Meus Pagamentos & Fila
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black animate-pulse">
                  {pendingCount} na fila
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe pedidos da Loja, posição na fila de alta demanda e tokens de liberação
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { playClick(); navigate('/store'); }}
            className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold"
          >
            <Sparkles size={14} className="mr-1.5" /> Ir à Loja
          </Button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex bg-background/50 p-1.5 rounded-2xl border border-border/50 gap-1 w-full sm:w-fit">
        <button
          onClick={() => { playClick(); setActiveTab('all'); }}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'all'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
        >
          Todos ({payments.length})
        </button>
        <button
          onClick={() => { playClick(); setActiveTab('pending'); }}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
        >
          <Clock size={13} />
          Fila & Aguardando ({pendingCount})
        </button>
        <button
          onClick={() => { playClick(); setActiveTab('delivered'); }}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'delivered'
              ? 'bg-green-500 text-black shadow-md shadow-green-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
        >
          <CheckCircle2 size={13} />
          Entregues ({deliveredCount})
        </button>
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="animate-spin text-primary" size={28} />
            <span className="text-sm font-bold">Consultando transações seguras no banco de dados...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-12 px-4 rounded-3xl bg-background/30 border border-border/50 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
              <CreditCard size={28} />
            </div>
            <h3 className="font-bold text-base">Nenhum pagamento encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
              {activeTab === 'pending' 
                ? 'Você não possui nenhum pagamento pendente ou na fila de alta demanda no momento.'
                : 'Você ainda não realizou compras na Loja InstaBoost PRO.'}
            </p>
            <Button 
              onClick={() => { playClick(); navigate('/store'); }}
              className="rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 px-6"
            >
              <Zap size={16} className="mr-2" /> Turbinar com Moedas e Planos
            </Button>
          </div>
        ) : (
          filteredPayments.map((p, idx) => {
            const isDelivered = p.status === 'delivered' || p.status === 'approved' || p.delivered;
            const token = p.verificationToken || p.verification_token || `AUTH-PIX-${p.id.slice(0, 8).toUpperCase()}`;
            
            // Calculate real-time queue position
            let queueIndex = 1;
            if (!isDelivered && allPendingList.length > 0) {
              const foundIdx = allPendingList.findIndex(item => item.id === p.id);
              if (foundIdx !== -1) queueIndex = foundIdx + 1;
            }

            const itemType = p.itemType || p.item_type || 'coins';
            const itemName = itemType === 'plan' 
              ? `Plano VIP ${(p.planId || p.plan_id || 'PRO').toUpperCase()} (30 Dias)` 
              : itemType === 'tickets' 
                ? `${p.amount || 10} Tickets da Roleta` 
                : `${(p.amount || 2500).toLocaleString('pt-BR')} Moedas`;

            return (
              <motion.div
                key={p.id || idx}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-5 sm:p-6 rounded-3xl border transition-all ${
                  !isDelivered
                    ? 'bg-gradient-to-br from-amber-500/5 via-background/60 to-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'bg-background/40 border-border/60 hover:border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Item info */}
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      !isDelivered
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                    }`}>
                      {itemType === 'coins' && <AnimatedIcon type="coin" size={24} />}
                      {itemType === 'tickets' && <AnimatedIcon type="ticket" size={24} />}
                      {itemType === 'plan' && <Sparkles size={24} />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-base tracking-tight text-foreground">
                          {itemName}
                        </h4>
                        
                        {!isDelivered ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                            <Clock size={11} className="animate-spin" /> Na Fila de Alta Demanda
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-400/30 flex items-center gap-1">
                            <CheckCircle2 size={11} /> Entregue na Conta
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-bold text-foreground">
                          R$ {(p.price || 0).toFixed(2).replace('.', ',')}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-mono text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded">
                          {p.method || 'PIX'}
                        </span>
                        <span>•</span>
                        <span className="text-[11px]">
                          {p.createdAt || p.created_at 
                            ? new Date(p.createdAt || p.created_at).toLocaleString('pt-BR') 
                            : 'Recente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status / Position Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {!isDelivered ? (
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-amber-400/80">Posição Global</span>
                        <span className="text-lg font-black text-amber-300 font-mono">
                          #{queueIndex} <span className="text-xs font-normal text-muted-foreground">de {allPendingCount || 1}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-green-400/80">Status</span>
                        <span className="text-sm font-black text-green-400 flex items-center gap-1">
                          <ShieldCheck size={16} /> Aprovado
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional controls for pending queue */}
                {!isDelivered && (
                  <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-4">
                    {/* Countdown and progress bar */}
                    <PaymentCountdown createdAt={p.createdAt || p.created_at} />

                    {/* Token & 1-Click Verification */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-secondary/40 p-3 rounded-2xl border border-border/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Token de Segurança:</span>
                        <span className="font-mono text-xs font-bold text-primary truncate select-all">
                          {token}
                        </span>
                        <button
                          onClick={() => handleCopyToken(token)}
                          className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Copiar Token"
                        >
                          {copiedToken === token ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleVerifyNow(p)}
                        isLoading={validatingId === p.id}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs px-4 h-9 shadow-md shadow-amber-500/20 whitespace-nowrap"
                      >
                        <Zap size={14} className="mr-1.5" /> Validar & Liberar Agora
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
