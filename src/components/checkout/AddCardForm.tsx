import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { showNotification } from '../../context/NotificationContext';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddCardForm({ onSuccess, onCancel }: Props) {
   const [loading, setLoading] = useState(false);
   const [mpInstance, setMpInstance] = useState<any>(null);
   const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');

   const [paymentMethodType, setPaymentMethodType] = useState<'credit_card' | 'debit_card'>('credit_card');

   const [formData, setFormData] = useState({
      cardNumber: '',
      cardholderName: '',
      cardExpirationMonth: '',
      cardExpirationYear: '',
      securityCode: '',
      identificationType: 'CPF',
      identificationNumber: ''
   });
   
   const [brand, setBrand] = useState('unknown');

   useEffect(() => {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
         // @ts-ignore
         const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || 'TEST-00000000-0000-0000-0000-000000000000';
         const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
         setMpInstance(mp);
      };
      document.body.appendChild(script);
      return () => {
         document.body.removeChild(script);
      };
   }, []);

   const detectBrand = async (bin: string, type: 'credit_card'|'debit_card') => {
      if (!mpInstance || bin.length < 6) {
          setBrand('unknown');
          return;
      }
      try {
         const paymentMethods = await mpInstance.getPaymentMethods({ bin });
         const method = paymentMethods?.results?.find((m: any) => m.payment_type_id === type) || paymentMethods?.results?.[0];
         if (method) setBrand(method.id);
         else setBrand('unknown');
      } catch (e) {
         setBrand('unknown');
      }
   };

   const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
       let val = e.target.value.replace(/\D/g, '');
       if (val.length >= 6) detectBrand(val.substring(0, 6), paymentMethodType);
       else setBrand('unknown');
       
       let formatted = val;
       if (val.length > 4) formatted = val.match(/.{1,4}/g)?.join(' ') || val;
       setFormData(f => ({ ...f, cardNumber: formatted.substring(0, 19) }));
   };

   useEffect(() => {
       const bin = formData.cardNumber.replace(/\D/g, '').substring(0, 6);
       if (bin.length >= 6) detectBrand(bin, paymentMethodType);
   }, [paymentMethodType]);
   
   const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
       let val = e.target.value.replace(/\D/g, '');
       if (val.length > 2) val = `${val.substring(0,2)}/${val.substring(2,4)}`;
       const parts = val.split('/');
       setFormData(f => ({ ...f, cardExpirationMonth: parts[0] || '', cardExpirationYear: parts[1] || '' }));
   };
   
   const handleCpf = (e: React.ChangeEvent<HTMLInputElement>) => {
       let val = e.target.value.replace(/\D/g, '');
       let formatted = val;
       if (val.length > 3) formatted = `${val.substring(0,3)}.${val.substring(3, 6)}`;
       if (val.length > 6) formatted = `${val.substring(0,3)}.${val.substring(3, 6)}.${val.substring(6, 9)}`;
       if (val.length > 9) formatted = `${val.substring(0,3)}.${val.substring(3, 6)}.${val.substring(6, 9)}-${val.substring(9, 11)}`;
       setFormData(f => ({ ...f, identificationNumber: formatted }));
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!mpInstance) return showNotification.error('MercadoPago não carregado.');
      
      setStep('processing');
      setLoading(true);
      try {
          const rawCardNumber = formData.cardNumber.replace(/\D/g, '');
          const tokenRes = await mpInstance.createCardToken({
              cardNumber: rawCardNumber,
              cardholderName: formData.cardholderName,
              cardExpirationMonth: formData.cardExpirationMonth,
              cardExpirationYear: `20${formData.cardExpirationYear}`,
              securityCode: formData.securityCode,
              identificationType: formData.identificationType,
              identificationNumber: formData.identificationNumber.replace(/\D/g, '')
          });

          if (!tokenRes || !tokenRes.id) throw new Error('Erro ao gerar token do cartão.');

          const res = await fetch('/api/payments/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  token: tokenRes.id,
                  payerDocument: formData.identificationNumber || undefined
              })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          setStep('success');
          setTimeout(() => {
              onSuccess();
          }, 2000);

      } catch (err: any) {
          console.error(err);
          showNotification.error(err.message || 'Erro ao salvar cartão.');
          setStep('form');
          setLoading(false);
      }
   };

   return (
      <div className="bg-card w-full max-w-md mx-auto p-6 rounded-3xl border shadow-xl relative overflow-hidden">
         <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-secondary rounded-full hover:bg-secondary/80 text-muted-foreground"><X size={16} /></button>
         
         <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Salvar Cartão</h2>
            <div className="flex items-center justify-center gap-1 text-xs text-green-500 mt-2">
                <ShieldCheck size={14} /> Seus dados ficam protegidos no MercadoPago
            </div>
         </div>

         <AnimatePresence mode="wait">
            {step === 'form' && (
               <motion.div key="form" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}>
                   <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
                       {/* Animated Card Preview */}
                       <div className="w-full h-44 rounded-2xl bg-gradient-to-tr from-gray-900 to-gray-700 shadow-xl overflow-hidden relative text-white p-5 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-8 bg-yellow-400/80 rounded flex items-end justify-start p-1 outline outline-1 outline-yellow-500/50">
                                 <div className="w-3 h-4 border-r border-black/20" />
                                 <div className="w-3 h-4 border-r border-black/20" />
                             </div>
                             <div className="font-bold italic opacity-80 text-lg uppercase">{brand === 'unknown' ? 'CARD' : brand}</div>
                          </div>
                          <div>
                             <div className="font-mono text-lg tracking-widest opacity-90">{formData.cardNumber || '•••• •••• •••• ••••'}</div>
                             <div className="flex justify-between mt-2 text-xs opacity-75 font-medium uppercase font-mono">
                                 <span>{formData.cardholderName || 'NOME DO TITULAR'}</span>
                                 <span>{formData.cardExpirationMonth ? `${formData.cardExpirationMonth}/${formData.cardExpirationYear}` : 'MM/AA'}</span>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 gap-3 relative z-10">
                           <div className="flex bg-secondary p-1 rounded-xl gap-1">
                               <button 
                                  type="button" 
                                  className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${paymentMethodType === 'credit_card' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                  onClick={() => setPaymentMethodType('credit_card')}
                               >
                                  Crédito
                               </button>
                               <button 
                                  type="button" 
                                  className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${paymentMethodType === 'debit_card' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                  onClick={() => setPaymentMethodType('debit_card')}
                               >
                                  Débito
                               </button>
                           </div>
                           
                           <div className="relative">
                               <input type="text" required placeholder="Número do Cartão" value={formData.cardNumber} onChange={handleCardNumber} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                           </div>
                           <input type="text" required placeholder="Nome Impresso no Cartão" value={formData.cardholderName} onChange={e => setFormData(f=>({...f, cardholderName: e.target.value.toUpperCase()}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                           <div className="grid grid-cols-2 gap-3">
                               <input type="text" required placeholder="Validade (MM/AA)" value={`${formData.cardExpirationMonth}${formData.cardExpirationMonth && !formData.cardExpirationYear ? '/' : ''}${formData.cardExpirationYear ? `/${formData.cardExpirationYear}` : ''}`} onChange={handleExpiry} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                               <input type="text" required placeholder="CVV" maxLength={4} value={formData.securityCode} onChange={e => setFormData(f=>({...f, securityCode: e.target.value.replace(/\D/g, '')}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                           </div>
                           <input type="text" required placeholder="CPF do Titular" value={formData.identificationNumber} onChange={handleCpf} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                       </div>
                       
                       <Button type="submit" variant="primary" className="w-full py-6 mt-2 relative overflow-hidden" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" /> : 'Salvar Cartão'}
                       </Button>
                   </form>
               </motion.div>
            )}

            {step === 'processing' && (
               <motion.div key="processing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center justify-center py-12">
                   <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-secondary animate-pulse absolute top-0 left-0" />
                      <div className="w-24 h-24 rounded-full border-4 border-primary border-t-transparent animate-spin relative z-10" />
                      <ShieldCheck className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary opacity-50" size={32} />
                   </div>
                   <h3 className="mt-6 text-lg font-bold">Salvando de forma segura...</h3>
                   <p className="text-sm text-muted-foreground mt-2 px-6 text-center">Os dados do cartão não são armazenados em nossos servidores.</p>
               </motion.div>
            )}

            {step === 'success' && (
               <motion.div key="success" initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} className="flex flex-col items-center justify-center py-12 text-center text-green-500">
                   <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring", delay: 0.2}}>
                       <CheckCircle2 size={80} className="mb-4 stroke-[1.5]" />
                   </motion.div>
                   <h3 className="text-2xl font-bold">Cartão Salvo!</h3>
                   <p className="text-sm text-muted-foreground mt-2 text-black dark:text-white">Agora você pode fazer pagamentos com um clique.</p>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}
