import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { showNotification } from '../context/NotificationContext';
import { QrCode, Copy, Zap, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Store() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ id: string, qrCode: string, pixCode: string, exactExpiry: number } | null>(null);
  const [polling, setPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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
        setPaymentData({ ...data, exactExpiry: Date.now() + 15 * 60 * 1000 });
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
              <p className="text-muted-foreground mt-2">Muito obrigado por contribuir. Seus créditos já foram adicionados na sua conta.</p>
            </div>
            <Button size="lg" className="mt-4" onClick={() => { setPaymentSuccess(false); setPaymentData(null); }}>
              Voltar para Loja
            </Button>
          </motion.div>
        ) : !paymentData ? (
          <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="text-yellow-500" /> Loja de Créditos
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Compre créditos via PIX para destacar seus links.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <div key={pkg.c} className={`relative bg-card border rounded-3xl p-5 flex flex-col items-center gap-2 ${pkg.pop ? 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30 ring-2 ring-primary/20 shadow-md z-10' : 'border-border'}`}>
                  <div className="text-2xl mt-2 border-b border-border/50 pb-2 w-full text-center">
                    <span className="font-bold">{pkg.c.toLocaleString('pt-BR')}</span> <span className="text-lg">💰</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">Destaque por <br/> <strong className="text-foreground">{pkg.time}</strong></div>
                  <div className="font-bold text-lg mt-1">{pkg.price}</div>
                  <Button className="w-full mt-2" variant={pkg.pop ? 'primary' : 'secondary'} onClick={() => handleBuy(pkg.c)} isLoading={loading}>
                    Comprar
                  </Button>
                </div>
              ))}
            </div>
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
