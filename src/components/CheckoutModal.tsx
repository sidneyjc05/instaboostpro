import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  QrCode, 
  Copy, 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  CheckCircle, 
  Trash2, 
  Plus, 
  Lock, 
  Check, 
  ChevronRight, 
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Flame
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { showNotification } from '../context/NotificationContext';
import { useAppSound } from '../context/SoundContext';
import { AnimatedIcon } from './AnimatedIcon';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  getUserSavedCards,
  deleteUserSavedCard,
  createPixPayment,
  processCardPayment,
  deliverPurchase,
  SavedCard
} from '../lib/store';

export interface CheckoutItem {
  credits: number | string;
  type: 'credits' | 'tickets' | 'plan';
  rawPrice: number;
  title: string;
  subtitle?: string;
  priceFormatted: string;
  originalPrice?: string;
  discountPercent?: number;
  time?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CheckoutItem | null;
  onSuccess: (data: any) => void;
}

function detectBrand(number: string): string {
  const clean = number.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(4011|438935|451416|4576|504175|506699|5067|509|627780|636297|636368|650|6516|6550)/.test(clean)) return 'elo';
  if (/^(606282|3841)/.test(clean)) return 'hipercard';
  if (/^6(011|5)/.test(clean)) return 'discover';
  return 'credit_card';
}

function getBrandBadge(brand: string) {
  const b = (brand || '').toLowerCase();
  if (b.includes('master')) {
    return (
      <div className="flex items-center gap-1 font-black text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block -mr-1.5 opacity-90" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
        <span className="ml-1 tracking-tight">Mastercard</span>
      </div>
    );
  }
  if (b.includes('visa')) {
    return (
      <div className="font-black italic text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 tracking-wider">
        VISA
      </div>
    );
  }
  if (b.includes('elo')) {
    return (
      <div className="font-black text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20 tracking-wider">
        ELO
      </div>
    );
  }
  if (b.includes('amex')) {
    return (
      <div className="font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 tracking-wider">
        AMEX
      </div>
    );
  }
  if (b.includes('hiper')) {
    return (
      <div className="font-black italic text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 tracking-wider">
        HIPER
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
      <CreditCard size={12} />
      <span>Cartão</span>
    </div>
  );
}

export function CheckoutModal({ isOpen, onClose, item, onSuccess }: CheckoutModalProps) {
  const { user, refreshUser } = useAuth();
  const { playClick, playSuccess } = useAppSound();

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [loading, setLoading] = useState(false);
  const [checkingStep, setCheckingStep] = useState<string | null>(null);

  // PIX state
  const [pixData, setPixData] = useState<{ id: string; qrCode: string | null; pixCode: string; exactExpiry: number } | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState(15 * 60);

  // Card state
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | 'new'>('new');
  
  // New Card Form
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState(user?.username ? user.username.toUpperCase() : '');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [installments, setInstallments] = useState('1');
  const [saveCard, setSaveCard] = useState(true);

  // Saved Card CVV prompt
  const [savedCardCvv, setSavedCardCvv] = useState('');

  // Fetch saved cards on open or when switching to card tab
  const fetchSavedCards = async () => {
    if (!user?.id) return;
    setLoadingCards(true);
    try {
      const cards = await getUserSavedCards(String(user.id));
      setSavedCards(cards);
      if (cards.length > 0) {
        setSelectedCardId(cards[0].id);
      } else {
        setSelectedCardId('new');
      }
    } catch (err) {
      console.warn('Could not fetch saved cards:', err);
    } finally {
      setLoadingCards(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSavedCards();
      setPixData(null);
      setCheckingStep(null);
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCpf('');
      setBirthDate('');
      setInstallments('1');
      setSavedCardCvv('');
    }
  }, [isOpen, user?.id]);

  // Handle PIX Countdown & Polling
  useEffect(() => {
    let timer: any;
    let pollInterval: any;
    let unsubFirestore: (() => void) | null = null;
    
    if (pixData) {
      // Countdown
      timer = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((pixData.exactExpiry - now) / 1000);
        if (diff <= 0) {
          clearInterval(timer);
          clearInterval(pollInterval);
          if (unsubFirestore) unsubFirestore();
          setPixData(null);
          showNotification.error('Tempo do QR Code PIX expirou.');
        } else {
          setPixTimeLeft(diff);
        }
      }, 1000);

      const handleApproved = async (approvedAmount?: number) => {
        clearInterval(timer);
        clearInterval(pollInterval);
        if (unsubFirestore) unsubFirestore();
        setPixData(null);
        playSuccess();
        showNotification.success('Pagamento PIX Aprovado com sucesso!');
        try {
          await deliverPurchase(String(user.id), item.type, item.credits);
        } catch (e) {
          console.warn('Local Firestore delivery sync:', e);
        }
        await refreshUser();
        onSuccess({
          id: pixData.id,
          paymentMethod: 'pix',
          pendingPlan: item?.type === 'plan' ? String(item?.credits) : undefined,
          tickets: item?.type === 'tickets' ? Number(item?.credits) : 0,
          credits: item?.type === 'credits' ? Number(item?.credits) : 0,
          amount: approvedAmount || 0
        });
        onClose();
      };

      // 1. Listen to real-time Firestore payments collection
      try {
        unsubFirestore = onSnapshot(doc(db, 'payments', pixData.id), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'approved') {
              handleApproved(data.amount);
            } else if (data.status === 'rejected' || data.status === 'cancelled') {
              clearInterval(timer);
              clearInterval(pollInterval);
              if (unsubFirestore) unsubFirestore();
              setPixData(null);
              showNotification.error('Pagamento recusado ou cancelado.');
            }
          }
        });
      } catch (e) {
        console.warn('Firestore onSnapshot notice:', e);
      }

      // 2. Polling backend for status (if fullstack server is present)
      pollInterval = setInterval(async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch(`/api/payments/${pixData.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const result = await res.json();
            if (result.status === 'approved') {
              handleApproved(result.amount);
            } else if (result.status === 'rejected' || result.status === 'cancelled') {
              clearInterval(timer);
              clearInterval(pollInterval);
              if (unsubFirestore) unsubFirestore();
              setPixData(null);
              showNotification.error('Pagamento recusado ou cancelado.');
            }
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 5000);
    }
    
    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
      if (unsubFirestore) unsubFirestore();
    };
  }, [pixData]);

  if (!isOpen || !item) return null;

  const detectedBrand = detectBrand(cardNumber);

  // Format Helpers
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = v.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) {
      v = `${v.slice(0, 2)}/${v.slice(2)}`;
    }
    setExpiry(v);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(v);
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 4) v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
    setBirthDate(v);
  };

  // Delete a saved card
  const handleDeleteCard = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    if (!confirm('Deseja remover este cartão salvo do seu perfil Firebase?')) return;
    try {
      await deleteUserSavedCard(String(user.id), cardId);
      showNotification.success('Cartão removido do perfil Firebase.');
      const updated = savedCards.filter(c => c.id !== cardId);
      setSavedCards(updated);
      if (selectedCardId === cardId) {
        setSelectedCardId(updated.length > 0 ? updated[0].id : 'new');
      }
    } catch {
      showNotification.error('Erro de conexão ao remover cartão.');
    }
  };

  // Generate PIX
  const handleGeneratePix = async () => {
    if (!user?.id) return;
    
    if (cpf.replace(/\D/g, '').length !== 11) {
      showNotification.error('Digite um CPF válido com 11 dígitos.');
      return;
    }
    if (birthDate.replace(/\D/g, '').length !== 8) {
      showNotification.error('Digite a data de nascimento corretamente (DD/MM/AAAA).');
      return;
    }

    playClick();
    setLoading(true);
    try {
      const data = await createPixPayment(String(user.id), {
        credits: item.credits,
        type: item.type,
        cpf: cpf,
        birthDate: birthDate,
        username: user?.username || 'usuario',
        email: user?.email || auth.currentUser?.email || undefined
      });

      playSuccess();
      setPixData({
        id: data.id,
        qrCode: data.qrCode,
        pixCode: data.pixCode,
        exactExpiry: Date.now() + (15 * 60 * 1000)
      });
      setPixTimeLeft(15 * 60);
    } catch (err: any) {
      showNotification.error(err.message || 'Erro ao gerar PIX');
    } finally {
      setLoading(false);
    }
  };

  // Process Credit Card Payment with Intelligent Step Animation
  const handlePayWithCard = async () => {
    if (!user?.id) return;
    
    if (cpf.replace(/\D/g, '').length !== 11) {
      showNotification.error('Digite um CPF válido com 11 dígitos.');
      return;
    }
    if (birthDate.replace(/\D/g, '').length !== 8) {
      showNotification.error('Digite a data de nascimento corretamente (DD/MM/AAAA).');
      return;
    }

    playClick();

    if (selectedCardId === 'new') {
      const cleanNum = cardNumber.replace(/\D/g, '');
      if (cleanNum.length < 13) {
        showNotification.error('Digite um número de cartão válido.');
        return;
      }
      if (!cardholderName.trim()) {
        showNotification.error('Digite o nome impresso no cartão.');
        return;
      }
      const expParts = expiry.split('/');
      if (expParts.length !== 2 || Number(expParts[0]) < 1 || Number(expParts[0]) > 12) {
        showNotification.error('Validade do cartão inválida (MM/AA).');
        return;
      }
      if (cvv.length < 3) {
        showNotification.error('Digite o código de segurança (CVV) de 3 ou 4 dígitos.');
        return;
      }
    }

    setLoading(true);
    setCheckingStep('Conectando ao Firebase Firestore...');

    try {
      await new Promise(r => setTimeout(r, 400));
      setCheckingStep('Executando verificação antifraude inteligente...');

      // Prepare payload
      let payload: any = {
        credits: item.credits,
        type: item.type,
        installments: Number(installments) || 1,
        docNumber: cpf.replace(/\D/g, ''),
        docType: 'CPF',
        username: user?.username || 'usuario',
        email: user?.email || auth.currentUser?.email || undefined
      };

      if (selectedCardId === 'new') {
        const [m, y] = expiry.split('/');
        const fullYear = y.length === 2 ? `20${y}` : y;
        payload = {
          ...payload,
          cardNumber: cardNumber.replace(/\D/g, ''),
          cardholderName: cardholderName.trim().toUpperCase(),
          expirationMonth: Number(m),
          expirationYear: Number(fullYear),
          securityCode: cvv,
          saveCard: saveCard,
        };
      } else {
        payload = {
          ...payload,
          savedCardId: selectedCardId,
          securityCode: savedCardCvv || '123'
        };
      }

      await new Promise(r => setTimeout(r, 400));
      setCheckingStep('Aprovando transação no banco de dados...');

      const data = await processCardPayment(String(user.id), payload);

      if (data.status === 'approved') {
        try {
          await deliverPurchase(String(user.id), item.type, item.credits);
        } catch (e) {
          console.warn('Local Firestore delivery sync:', e);
        }
      }

      playSuccess();
      showNotification.success('Pagamento no cartão APROVADO com sucesso!');
      await refreshUser();
      onSuccess({
        ...data,
        paymentMethod: 'credit_card',
        pendingPlan: item.type === 'plan' ? String(item.credits) : undefined,
        tickets: item.type === 'tickets' ? Number(item.credits) : 0,
        credits: item.type === 'credits' ? Number(item.credits) : 0
      });
      onClose();
    } catch (err: any) {
      showNotification.error(err?.message || 'Erro ao processar pagamento no cartão.');
    } finally {
      setLoading(false);
      setCheckingStep(null);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Generate Installments Options
  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const count = i + 1;
    const val = item.rawPrice / count;
    return {
      count,
      label: count === 1 
        ? `1x de R$ ${item.rawPrice.toFixed(2).replace('.', ',')} (à vista)` 
        : `${count}x de R$ ${val.toFixed(2).replace('.', ',')} sem juros`
    };
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
        className="relative w-full max-w-xl bg-card border border-border/80 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 overflow-hidden z-10 my-auto text-foreground"
      >
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <X size={20} />
        </button>

        {/* Header Summary */}
        <div className="flex items-start gap-4 mb-6 pr-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 via-blue-500/10 to-transparent border border-primary/30 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10">
            {item.type === 'credits' ? (
              <AnimatedIcon type="coin" size={32} />
            ) : item.type === 'tickets' ? (
              <AnimatedIcon type="ticket" size={32} />
            ) : (
              <AnimatedIcon type="diamond" size={32} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{item.title}</h3>
              {item.discountPercent && item.discountPercent > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                  -{item.discountPercent}% OFF
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-green-400 tracking-tight">{item.priceFormatted}</span>
              {item.originalPrice && (
                <span className="text-xs text-muted-foreground line-through font-bold">{item.originalPrice}</span>
              )}
              {item.time && (
                <span className="text-[10px] uppercase font-bold text-muted-foreground/80 bg-secondary px-2 py-0.5 rounded-md ml-auto">
                  {item.time}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Payment Verification Fields */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              CPF do Titular
            </label>
            <Input
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              className="font-mono font-bold tracking-wider h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Data Nasc.
            </label>
            <Input
              placeholder="DD/MM/AAAA"
              value={birthDate}
              onChange={handleBirthDateChange}
              className="font-mono font-bold tracking-wider h-11 rounded-xl"
            />
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-secondary/40 border border-border/60 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => { playClick(); setPaymentMethod('pix'); }}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              paymentMethod === 'pix'
                ? 'bg-background text-primary shadow-lg border border-border/80 scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Zap size={16} className={paymentMethod === 'pix' ? 'text-primary fill-primary/20' : ''} />
            <span>PIX Instantâneo</span>
          </button>
          <button
            type="button"
            onClick={() => { playClick(); setPaymentMethod('card'); }}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              paymentMethod === 'card'
                ? 'bg-background text-primary shadow-lg border border-border/80 scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <CreditCard size={16} className={paymentMethod === 'card' ? 'text-primary' : ''} />
            <span>Cartão de Crédito</span>
          </button>
        </div>

        {/* --- PIX VIEW --- */}
        {paymentMethod === 'pix' && (
          <div className="flex flex-col items-center text-center">
            {!pixData ? (
              <div className="flex flex-col items-center gap-4 py-4 w-full">
                <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/5">
                  <QrCode size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-foreground">Pagamento Instantâneo via PIX</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Gere o QR Code e o código Pix Copia e Cola para liberação automática em menos de 10 segundos pelo Mercado Pago.
                  </p>
                </div>

                <div className="w-full bg-background/50 border border-border/60 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-green-400" /> Mercado Pago Seguro</span>
                  <span className="flex items-center gap-1.5"><Clock size={16} className="text-primary" /> Validade: 15 minutos</span>
                </div>

                <Button 
                  onClick={handleGeneratePix}
                  isLoading={loading}
                  size="lg"
                  className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 mt-2"
                >
                  <QrCode className="mr-2" size={20} /> Gerar PIX Agora
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex w-full justify-between items-center bg-secondary/50 px-4 py-2.5 rounded-xl border border-border text-xs font-bold">
                  <span className="text-muted-foreground">Expira em:</span>
                  <span className="font-mono text-destructive font-black text-sm tracking-wider animate-pulse">
                    {formatSeconds(pixTimeLeft)}
                  </span>
                </div>

                {pixData.qrCode ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl border border-white/20">
                    <img src={pixData.qrCode} alt="PIX QR Code" className="w-44 h-44 sm:w-52 sm:h-52 object-contain" />
                  </div>
                ) : (
                  <div className="p-6 bg-secondary/50 rounded-2xl w-full text-center text-xs text-muted-foreground">
                    QR Code visual disponível no App do Mercado Pago. Use o Copia e Cola abaixo.
                  </div>
                )}

                <div className="w-full flex gap-2">
                  <div className="flex-1 bg-background/80 border border-border rounded-xl px-3 py-2 text-xs font-mono truncate text-left text-muted-foreground flex items-center">
                    {pixData.pixCode}
                  </div>
                  <Button 
                    variant="outline"
                    className="shrink-0 font-black text-xs uppercase tracking-wider rounded-xl h-10 px-4"
                    onClick={() => {
                      navigator.clipboard.writeText(pixData.pixCode);
                      showNotification.success('Código PIX copiado com sucesso!');
                    }}
                  >
                    <Copy size={14} className="mr-1.5" /> Copiar
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary animate-pulse py-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  Aguardando confirmação do banco...
                </div>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setPixData(null)}
                >
                  Voltar e alterar forma de pagamento
                </Button>
              </div>
            )}
          </div>
        )}

        {/* --- CARD VIEW --- */}
        {paymentMethod === 'card' && (
          <div className="flex flex-col gap-5">
            {/* Saved Cards Carousel/Selector */}
            {savedCards.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>Cartões Salvos no seu Perfil (Firebase)</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    Sincronizado
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedCards.map((c) => {
                    const isSelected = selectedCardId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => { playClick(); setSelectedCardId(c.id); }}
                        className={`relative p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30'
                            : 'bg-secondary/30 border-border/60 hover:border-border hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {getBrandBadge(c.brand)}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCard(c.id, e)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-white/5 transition-colors"
                            title="Remover cartão do Firebase"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div>
                          <div className="text-sm font-black tracking-widest text-foreground font-mono">
                            •••• •••• •••• {c.lastFourDigits}
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mt-0.5">
                            <span className="truncate max-w-[110px]">{c.cardholderName}</span>
                            <span>{String(c.expirationMonth).padStart(2, '0')}/{String(c.expirationYear).slice(-2)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-8 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-background">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => { playClick(); setSelectedCardId('new'); }}
                    className={`p-3.5 rounded-2xl border border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-1.5 text-xs font-bold ${
                      selectedCardId === 'new'
                        ? 'bg-primary/10 border-primary text-primary shadow-lg ring-1 ring-primary/30'
                        : 'bg-secondary/20 border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Plus size={16} />
                    </div>
                    <span>Adicionar novo cartão</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Paying with a Saved Card */}
            {selectedCardId !== 'new' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-background/60 border border-border/80 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">Código de Segurança (CVV):</span>
                  <div className="w-28">
                    <Input
                      type="password"
                      maxLength={4}
                      placeholder="123"
                      value={savedCardCvv}
                      onChange={(e) => setSavedCardCvv(e.target.value.replace(/\D/g, ''))}
                      className="text-center font-mono font-black tracking-widest h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Opções de Parcelamento</label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full h-11 bg-secondary/60 border border-border rounded-xl px-3 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {installmentOptions.map(opt => (
                      <option key={opt.count} value={opt.count} className="bg-card text-foreground">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}

            {/* If Adding/Using New Card */}
            {selectedCardId === 'new' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Visual Card Preview */}
                <div className="relative w-full h-40 sm:h-44 rounded-2xl p-5 overflow-hidden bg-gradient-to-tr from-zinc-950 via-slate-900 to-zinc-900 border border-white/10 shadow-2xl flex flex-col justify-between text-white">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-6 rounded bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200 shadow-inner flex items-center justify-center opacity-90">
                        <div className="w-6 h-4 border border-black/30 rounded-sm" />
                      </div>
                      <span className="text-[9px] uppercase font-black tracking-widest text-zinc-400">InstaBoost Pay</span>
                    </div>
                    {getBrandBadge(detectedBrand)}
                  </div>

                  <div className="relative z-10 text-base sm:text-lg font-mono font-black tracking-[0.2em] text-zinc-100 drop-shadow">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </div>

                  <div className="flex items-end justify-between relative z-10 text-[10px] sm:text-xs">
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-zinc-400 font-bold">Titular</div>
                      <div className="font-black uppercase tracking-wider truncate max-w-[180px]">
                        {cardholderName || 'NOME DO TITULAR'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-zinc-400 font-bold">Validade</div>
                      <div className="font-mono font-black">{expiry || 'MM/AA'}</div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Número do Cartão
                    </label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="font-mono font-bold tracking-wider h-11 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Nome Impresso no Cartão
                    </label>
                    <Input
                      placeholder="Ex: JOAO S SILVA"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                      className="font-bold tracking-wide h-11 rounded-xl uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Validade
                      </label>
                      <Input
                        placeholder="MM/AA"
                        value={expiry}
                        onChange={handleExpiryChange}
                        className="font-mono font-bold text-center h-11 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                        CVV
                      </label>
                      <Input
                        type="password"
                        maxLength={4}
                        placeholder="123"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                        className="font-mono font-bold text-center h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Parcelas
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="w-full h-11 bg-secondary/60 border border-border rounded-xl px-3 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {installmentOptions.map(opt => (
                        <option key={opt.count} value={opt.count} className="bg-card text-foreground">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Save Card Checkbox */}
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-bold text-foreground/90">
                      Salvar este cartão no meu perfil (Firebase) para compras futuras
                    </span>
                  </label>
                </div>
              </motion.div>
            )}

            {/* Checkup Loading Banner */}
            {checkingStep && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center gap-3 text-xs font-bold text-primary animate-pulse"
              >
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                <span>{checkingStep}</span>
              </motion.div>
            )}

            {/* Submit Card Button */}
            <Button
              onClick={handlePayWithCard}
              isLoading={loading}
              size="lg"
              className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 mt-2"
            >
              <Lock className="mr-2" size={18} /> Pagar {item.priceFormatted}
            </Button>
          </div>
        )}

        {/* Security Footer Note */}
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
          <ShieldCheck size={14} className="text-green-400" />
          <span>Pagamento 100% Seguro com Criptografia SSL & Firebase</span>
        </div>
      </motion.div>
    </div>
  );
}
