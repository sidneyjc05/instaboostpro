import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { saveLocalCard } from '../../lib/cardStorage';
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
          
          // We still validate and detect brand via MP but we save the data locally
          const bin = rawCardNumber.substring(0, 6);
          const paymentMethods = await mpInstance.getPaymentMethods({ bin });
          const method = paymentMethods?.results?.find((m: any) => m.payment_type_id === paymentMethodType) || paymentMethods?.results?.[0];
          let detectedBrand = method ? method.id : 'unknown';

          // Force correct brand ID for debit cards if not already set correctly by MP
          if (paymentMethodType === 'debit_card') {
              if (detectedBrand === 'visa') detectedBrand = 'debvisa';
              else if (detectedBrand === 'master') detectedBrand = 'debmaster';
              else if (detectedBrand === 'cabal') detectedBrand = 'debcabal';
              else if (detectedBrand === 'maestro') detectedBrand = 'debmaster'; // standard fallback
          } else {
              // Ensure it's NOT a debit brand if user chose credit
              if (detectedBrand === 'debvisa') detectedBrand = 'visa';
              else if (detectedBrand === 'debmaster') detectedBrand = 'master';
              else if (detectedBrand === 'debcabal') detectedBrand = 'cabal';
          }

          // Save locally
          saveLocalCard({
              id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              brand: detectedBrand,
              last_four: rawCardNumber.slice(-4),
              expiration_month: parseInt(formData.cardExpirationMonth),
              expiration_year: 2000 + parseInt(formData.cardExpirationYear),
              holder_name: formData.cardholderName,
              type: paymentMethodType,
              full_number: rawCardNumber
          });

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
      <div className="bg-card w-full max-w-md mx-auto p-6 rounded-[2.5rem] border border-border shadow-2xl relative overflow-hidden">
         <button onClick={onCancel} className="absolute top-6 right-6 p-2 bg-secondary rounded-full hover:bg-secondary/80 text-muted-foreground transition-all duration-200 z-20"><X size={18} /></button>
         
         <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
               <CreditCard size={32} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Vincular Cartão</h2>
            <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-green-500 mt-2 opacity-80">
                <ShieldCheck size={12} strokeWidth={3} /> Segurança MercadoPago
            </div>
         </div>

         <AnimatePresence mode="wait">
            {step === 'form' && (
               <motion.div key="form" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}>
                   <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative">
                       {/* Animated Card Preview */}
                       <div className="w-full h-48 rounded-[2rem] bg-gradient-to-tr from-gray-950 to-gray-800 shadow-2xl overflow-hidden relative text-white p-6 flex flex-col justify-between border border-white/5 group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />
                          <div className="flex justify-between items-start relative z-10">
                             <div className="w-14 h-10 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-lg flex flex-col items-center justify-center p-1 shadow-inner relative overflow-hidden">
                                 <div className="w-full h-[1px] bg-black/10 mt-1" />
                                 <div className="w-full h-[1px] bg-black/10 mt-1" />
                                 <div className="w-full h-[1px] bg-black/10 mt-1" />
                                 <div className="absolute inset-0 bg-white/10" />
                             </div>
                             <div className="font-extrabold italic opacity-90 text-xl uppercase tracking-tighter drop-shadow-sm">{brand === 'unknown' ? 'INSTABOOST' : brand}</div>
                          </div>
                          <div className="relative z-10">
                             <div className="font-mono text-xl tracking-[0.2em] mb-4 drop-shadow-lg">{formData.cardNumber || '•••• •••• •••• ••••'}</div>
                             <div className="flex justify-between mt-4 text-[10px] opacity-70 font-black uppercase tracking-widest font-mono">
                                 <div className="flex flex-col gap-1">
                                    <span className="opacity-50">Titular</span>
                                    <span className="text-sm truncate max-w-[180px]">{formData.cardholderName || 'NOME DO TITULAR'}</span>
                                 </div>
                                 <div className="flex flex-col items-end gap-1">
                                    <span className="opacity-50">Validade</span>
                                    <span className="text-sm">{formData.cardExpirationMonth ? `${formData.cardExpirationMonth}/${formData.cardExpirationYear}` : 'MM/AA'}</span>
                                 </div>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 gap-4">
                           <div className="flex bg-secondary/80 p-1.5 rounded-2xl gap-1.5 border border-border/50">
                               <button 
                                  type="button" 
                                  className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all duration-300 ${paymentMethodType === 'credit_card' ? 'bg-background shadow-md text-primary ring-1 ring-black/5 dark:ring-white/5' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                  onClick={() => setPaymentMethodType('credit_card')}
                               >
                                  Crédito
                               </button>
                               <button 
                                  type="button" 
                                  className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all duration-300 ${paymentMethodType === 'debit_card' ? 'bg-background shadow-md text-primary ring-1 ring-black/5 dark:ring-white/5' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                  onClick={() => setPaymentMethodType('debit_card')}
                               >
                                  Débito
                               </button>
                           </div>
                           
                           <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Número do Cartão</label>
                                 <input type="text" required placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={handleCardNumber} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Nome no Cartão</label>
                                 <input type="text" required placeholder="Ex: JOAO S SILVA" value={formData.cardholderName} onChange={e => setFormData(f=>({...f, cardholderName: e.target.value.toUpperCase()}))} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Validade</label>
                                    <input type="text" required placeholder="MM/AA" value={`${formData.cardExpirationMonth}${formData.cardExpirationMonth && !formData.cardExpirationYear ? '/' : ''}${formData.cardExpirationYear ? `/${formData.cardExpirationYear}` : ''}`} onChange={handleExpiry} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium text-center focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                                 </div>
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">CVV</label>
                                    <input type="text" required placeholder="000" maxLength={4} value={formData.securityCode} onChange={e => setFormData(f=>({...f, securityCode: e.target.value.replace(/\D/g, '')}))} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium text-center focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                                 </div>
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Seu CPF</label>
                                 <input type="text" required placeholder="000.000.000-00" value={formData.identificationNumber} onChange={handleCpf} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                              </div>
                           </div>
                       </div>
                       
                       <Button type="submit" variant="primary" className="w-full h-16 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" size={20} /> : (
                              <>
                                 <CheckCircle2 size={20} />
                                 Salvar Cartão com Segurança
                              </>
                           )}
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
