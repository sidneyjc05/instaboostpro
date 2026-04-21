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

  const packages = [
    { c: 5, price: 'R$ 0,50', time: '1 minuto' },
    { c: 10, price: 'R$ 1,00', time: '2 minutos' },
    { c: 25, price: 'R$ 2,00', time: '5 minutos' },
    { c: 55, price: 'R$ 5,00', time: '11 minutos' },
    { c: 125, price: 'R$ 10,00', time: '25 minutos' },
    { c: 285, price: 'R$ 20,00', time: '57 minutos' },
    { c: 640, price: 'R$ 50,00', time: '2h 8m', pop: true },
    { c: 1430, price: 'R$ 100,00', time: '4h 46m' },
    { c: 3210, price: 'R$ 200,00', time: '10h 42m' },
    { c: 7200, price: 'R$ 250,00', time: '24 horas', pop: true }
  ];

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="text-yellow-500" /> Loja de Créditos
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Compre créditos via PIX para destacar seus links.</p>
      </div>

      {!paymentData ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <div key={pkg.c} className={`relative bg-card border rounded-3xl p-5 flex flex-col items-center gap-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30 ring-2 ring-primary/20 shadow-md z-10' : 'border-border'}`}>
              <div className="text-2xl mt-2 border-b border-border/50 pb-2 w-full text-center">
                <span className="font-bold">{pkg.c.toLocaleString('pt-BR')}</span> <span className="text-lg">💰</span>
              </div>
              <div className="text-xs text-muted-foreground text-center">Destaque por <br/> <strong className="text-white">{pkg.time}</strong></div>
              <div className="font-bold text-lg mt-1">{pkg.price}</div>
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
    </div>
  );
}

// Temporary for loader
const Loader2 = ({ size, className }: any) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
