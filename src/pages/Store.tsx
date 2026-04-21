import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { QrCode, Copy, CheckCircle2, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function Store() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ id: string, qrCode: string, pixCode: string } | null>(null);
  const [polling, setPolling] = useState(false);

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
               showNotification.success('Pagamento aprovado! Créditos adicionados.');
               setPolling(false);
               setPaymentData(null);
               refreshUser();
            }
          }
        } catch {}
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [polling, paymentData]);

  const handleBuy = async (credits: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits })
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentData(data);
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

  const simulatePayment = async () => {
    if (!paymentData) return;
    try {
      await fetch('/api/webhook/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentData.id })
      });
      showNotification.success('Pagamento simulado via webhook!');
    } catch {}
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="text-yellow-500" /> Loja de Créditos
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Compre créditos via PIX para destacar seus links.</p>
      </div>

      {!paymentData ? (
        <div className="grid grid-cols-2 gap-4">
          {[
            { c: 100, price: 'R$ 10,00', pop: false },
            { c: 500, price: 'R$ 40,00', pop: true, save: '20%' },
            { c: 1000, price: 'R$ 70,00', pop: false, save: '30%' },
            { c: 2000, price: 'R$ 120,00', pop: false, save: '40%' },
          ].map(pkg => (
            <div key={pkg.c} className={`relative bg-card border rounded-3xl p-5 flex flex-col items-center gap-3 ${pkg.pop ? 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30 ring-2 ring-primary/20 scale-105 z-10' : 'border-border'}`}>
              {pkg.pop && <span className="absolute -top-3 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Mais Popular</span>}
              {pkg.save && <span className="absolute top-3 right-3 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Economize {pkg.save}</span>}
              <div className="text-3xl mt-4 border-b border-border/50 pb-4 w-full text-center">
                <span className="font-bold">{pkg.c}</span> <span className="text-xl">💰</span>
              </div>
              <div className="font-bold text-lg">{pkg.price}</div>
              <Button className="w-full mt-2" variant={pkg.pop ? 'primary' : 'secondary'} onClick={() => handleBuy(pkg.c)}>
                Comprar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center gap-6 text-center"
        >
          <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
            <QrCode size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Escaneie o QR Code</h3>
            <p className="text-sm text-muted-foreground mt-1">Aprovação em segundos. Escaneie pelo app do seu banco para pagar via PIX.</p>
          </div>
          
          <div className="p-2 bg-white rounded-xl">
            <img src={paymentData.qrCode} alt="PIX QR Code" className="w-48 h-48" />
          </div>

          <div className="w-full flex gap-2">
            <div className="flex-1 bg-secondary rounded-xl px-3 py-2 text-xs truncate border border-border flex items-center">
              {paymentData.pixCode.substring(0, 30)}...
            </div>
            <Button 
               variant="outline"
               onClick={() => {
                 navigator.clipboard.writeText(paymentData.pixCode);
                 showNotification.success('Código copiado!');
               }}
            >
              <Copy size={16} /> Copiar
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
            <Loader2 className="animate-spin" size={16} /> Aguardando pagamento...
          </div>

          {/* SIMULATION BUTTON FOR DEV  */}
          <button onClick={simulatePayment} className="text-[10px] text-muted-foreground underline mt-4">
             [DEV] Simular Pagamento Aprovado
          </button>
        </motion.div>
      )}
    </div>
  );
}

// Temporary for loader
const Loader2 = ({ size, className }: any) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
