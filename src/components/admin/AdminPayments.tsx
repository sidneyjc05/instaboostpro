import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Zap, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  DollarSign, 
  Users, 
  ExternalLink,
  Filter,
  Sparkles,
  CornerUpLeft
} from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';
import { AnimatedIcon } from '../AnimatedIcon';
import { useAppSound } from '../../context/SoundContext';
import confetti from 'canvas-confetti';

export function AdminPayments() {
  const { playClick, playSuccess } = useAppSound();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'refunds'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchPayments = () => {
    setLoading(true);
    // Realtime firestore listener + API fallback
    const q = collection(db, 'payments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Sort by creation time descending
      docs.sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setPayments(docs);
      setLoading(false);
    }, async (err) => {
      console.warn("Error subscribing to payments, fetching via API:", err);
      try {
        const res = await fetch('/api/admin/payments/all');
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments || []);
        }
      } catch (e) {}
      setLoading(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsub = fetchPayments();
    return () => unsub();
  }, []);

  const handleCopy = (text: string) => {
    playClick();
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    showNotification.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleApprovePayment = async (payment: any) => {
    playClick();
    setProcessingId(payment.id);
    try {
      // Try API approval first
      const res = await fetch(`/api/admin/payments/${payment.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Also deliver in Firestore if present
      const targetUserId = payment.userId || payment.user_id;
      if (targetUserId) {
        try {
          const userDocRef = doc(db, 'users', targetUserId);
          const itemType = payment.itemType || payment.item_type || 'coins';

          if (itemType === 'coins' && payment.amount) {
            await updateDoc(userDocRef, { credits: increment(Number(payment.amount)) });
          } else if (itemType === 'tickets' && payment.amount) {
            await updateDoc(userDocRef, { tickets: increment(Number(payment.amount)) });
          } else if (itemType === 'plan') {
            const planId = payment.planId || payment.plan_id || 'pro';
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await updateDoc(userDocRef, {
              plan_type: planId,
              plan_expires_at: expiresAt
            });
          }

          // Update payment document in Firestore
          const paymentDocRef = doc(db, 'payments', payment.id);
          await updateDoc(paymentDocRef, {
            status: 'delivered',
            delivered: true,
            approved_by_admin: true,
            updated_at: new Date().toISOString()
          });
        } catch (fErr) {
          console.warn("Firestore direct delivery notice:", fErr);
        }
      }

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
      playSuccess();
      showNotification.success('Pagamento aprovado e itens entregues com sucesso na conta!');
    } catch (err: any) {
      showNotification.error('Erro ao aprovar pagamento. Tente novamente.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmRefund = async (payment: any) => {
    playClick();
    setProcessingId(payment.id);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/confirm-refund`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.error) {
        showNotification.error(data.error);
      } else {
        playSuccess();
        showNotification.success('Reembolso concluído. Os itens foram removidos do usuário.');
      }
    } catch (err) {
      showNotification.error('Erro de conexão ao processar reembolso.');
    }
    setProcessingId(null);
  };

  // Metrics calculation
  const totalRevenue = payments
    .filter(p => p.status === 'delivered' || p.status === 'approved' || p.delivered)
    .reduce((acc, p) => acc + (Number(p.price) || 0), 0);

  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'in_queue' || (!p.delivered && p.status !== 'approved' && p.status !== 'refund_requested' && p.status !== 'refunded'));
  const deliveredPayments = payments.filter(p => p.status === 'delivered' || p.status === 'approved' || p.delivered);
  const refundRequests = payments.filter(p => p.status === 'refund_requested');

  const filtered = payments.filter(p => {
    const isDelivered = p.status === 'delivered' || p.status === 'approved' || p.delivered;
    if (filter === 'pending') return !isDelivered && p.status !== 'refund_requested' && p.status !== 'refunded';
    if (filter === 'delivered') return isDelivered;
    if (filter === 'refunds') return p.status === 'refund_requested' || p.status === 'refunded';
    return true;
  }).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const token = (p.verificationToken || p.verification_token || '').toLowerCase();
    const uName = (p.userName || p.username || '').toLowerCase();
    const email = (p.userEmail || p.email || '').toLowerCase();
    const id = String(p.id).toLowerCase();
    return token.includes(q) || uName.includes(q) || email.includes(q) || id.includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Faturamento Concluído</span>
            <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mt-2 text-green-400">
            R$ {totalRevenue.toFixed(2).replace('.', ',')}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            {deliveredPayments.length} pagamentos aprovados
          </p>
        </div>

        <div className="bg-card border border-amber-500/30 p-5 rounded-3xl relative overflow-hidden bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase">Fila de Alta Demanda</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 animate-pulse">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mt-2 text-amber-300">
            {pendingPayments.length} <span className="text-sm font-normal text-muted-foreground">pedidos</span>
          </h3>
          <p className="text-[11px] text-amber-400/80 mt-1">
            Aguardando validação de token / Pix
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Total de Transações</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CreditCard size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mt-2">
            {payments.length}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Histórico completo da Loja
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Tempo Médio de Fila</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Zap size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mt-2 text-blue-400">
            &lt; 30 min
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Com auto-liberação configurada
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por Token, Usuário, Email, ID..." 
            className="pl-10 h-10" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => { playClick(); setFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              filter === 'all'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({payments.length})
          </button>
          <button
            onClick={() => { playClick(); setFilter('pending'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filter === 'pending'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock size={13} />
            Na Fila ({pendingPayments.length})
          </button>
          <button
            onClick={() => { playClick(); setFilter('delivered'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filter === 'delivered'
                ? 'bg-green-500 text-black shadow-md shadow-green-500/20'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 size={13} />
            Entregues ({deliveredPayments.length})
          </button>
          <button
            onClick={() => { playClick(); setFilter('refunds'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filter === 'refunds'
                ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <CornerUpLeft size={13} />
            Reembolsos ({refundRequests.length})
          </button>
        </div>
      </div>

      {/* Payments Table / Cards */}
      <div className="bg-card w-full border border-border rounded-3xl p-6 overflow-x-auto">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="animate-spin text-primary" size={32} />
            <span className="text-sm font-bold">Carregando fila de pagamentos do sistema...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
            <CreditCard size={36} className="mb-2 opacity-50" />
            <p className="font-bold text-sm">Nenhum pagamento correspondente aos filtros</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30">
              <tr>
                <th className="p-3.5 rounded-tl-xl">Fila / ID</th>
                <th className="p-3.5">Usuário</th>
                <th className="p-3.5">Item Comprado</th>
                <th className="p-3.5">Valor (R$)</th>
                <th className="p-3.5">Token de Validação</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 rounded-tr-xl text-right">Ação Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, index) => {
                const isDelivered = p.status === 'delivered' || p.status === 'approved' || p.delivered;
                const token = p.verificationToken || p.verification_token || `AUTH-PIX-${p.id.slice(0, 8).toUpperCase()}`;
                
                // Calculate pending queue index
                const queueIdx = !isDelivered 
                  ? pendingPayments.findIndex(item => item.id === p.id) + 1 
                  : null;

                const itemType = p.itemType || p.item_type || 'coins';
                const itemName = itemType === 'plan' 
                  ? `Plano VIP ${(p.planId || p.plan_id || 'PRO').toUpperCase()}` 
                  : itemType === 'tickets' 
                    ? `${p.tickets || 10} Tickets` 
                    : `${(p.credits || 0).toLocaleString('pt-BR')} Moedas`;
                
                const displayPrice = p.amount || p.price || 0;

                return (
                  <tr 
                    key={p.id} 
                    className={`border-b border-border/50 last:border-0 transition-colors ${
                      !isDelivered ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-secondary/20'
                    }`}
                  >
                    {/* Fila / ID */}
                    <td className="p-3.5">
                      {!isDelivered ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-black text-xs font-mono">
                          #{queueIdx} NA FILA
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">
                          #{p.id.slice(0, 8)}
                        </span>
                      )}
                    </td>

                    {/* Usuário */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">
                          @{p.userName || p.username || (p.userId ? p.userId.slice(0, 8) : 'Usuário')}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.userEmail || p.email || 'Email não disp.'}
                        </span>
                      </div>
                    </td>

                    {/* Item */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        {itemType === 'coins' && <AnimatedIcon type="coin" size={18} />}
                        {itemType === 'tickets' && <AnimatedIcon type="ticket" size={18} />}
                        {itemType === 'plan' && <Sparkles size={18} className="text-amber-400" />}
                        <span className="font-bold">{itemName}</span>
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="p-3.5 font-bold font-mono text-green-400">
                      R$ {displayPrice.toFixed(2).replace('.', ',')}
                    </td>

                    {/* Token */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 max-w-[200px] truncate">
                        <span className="truncate">{token}</span>
                        <button
                          onClick={() => handleCopy(token)}
                          className="hover:text-white p-0.5"
                          title="Copiar Token"
                        >
                          {copiedToken === token ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      {!isDelivered && p.status !== 'refund_requested' && p.status !== 'refunded' ? (
                        <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1 w-fit">
                          <Clock size={12} className="animate-spin" /> Em Aguardo
                        </span>
                      ) : p.status === 'refund_requested' ? (
                        <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                          <CornerUpLeft size={12} /> Reembolso Solicitado
                        </span>
                      ) : p.status === 'refunded' ? (
                        <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-lg bg-secondary text-muted-foreground border border-border flex items-center gap-1 w-fit">
                          <CornerUpLeft size={12} /> Reembolsado
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1 w-fit">
                          <CheckCircle2 size={12} /> Entregue
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-3.5 text-right">
                      {!isDelivered && p.status !== 'refund_requested' && p.status !== 'refunded' ? (
                        <Button
                          size="sm"
                          onClick={() => handleApprovePayment(p)}
                          isLoading={processingId === p.id}
                          className="bg-green-500 hover:bg-green-400 text-black font-black text-xs rounded-xl shadow-md shadow-green-500/20"
                        >
                          <Zap size={14} className="mr-1" /> Liberar Agora
                        </Button>
                      ) : p.status === 'refund_requested' ? (
                        <div className="flex flex-col items-end gap-2">
                           <div className="text-[10px] font-mono bg-secondary/50 px-2 py-1 rounded text-muted-foreground max-w-[150px] truncate flex items-center gap-1">
                              PIX: {p.refund_pix_key} 
                              <button onClick={() => handleCopy(p.refund_pix_key)}><Copy size={10} /></button>
                           </div>
                           <Button
                              size="sm"
                              isLoading={processingId === p.id}
                              onClick={() => handleConfirmRefund(p)}
                              className="bg-red-500 hover:bg-red-400 text-white font-black text-xs h-8 px-3 rounded-xl shadow-md shadow-red-500/20"
                           >
                              Confirmar Reembolso
                           </Button>
                        </div>
                      ) : p.status === 'refunded' ? (
                        <span className="text-[10px] font-bold text-muted-foreground">Itens Removidos</span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-semibold">
                          Concluído
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
