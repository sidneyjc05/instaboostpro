import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, ShieldCheck, X, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { showNotification } from '../../context/NotificationContext';
import { SavedCard, saveLocalCard } from '../../lib/cardStorage';

interface Props {
  amount: number;
  originalAmount?: number;
  itemC: string | number;
  itemType: 'credits' | 'tickets' | 'plan';
  onSuccess: (paymentId: string, status: string) => void;
  onCancel: () => void;
  savedCards: SavedCard[];
  initialMethodType?: 'credit_card' | 'debit_card';
}

export function CreditCardForm({ amount, itemC, itemType, onSuccess, onCancel, savedCards, initialMethodType = 'credit_card' }: Props) {
   const [loading, setLoading] = useState(false);
   const [mpInstance, setMpInstance] = useState<any>(null);
   const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
   const [selectedCardId, setSelectedCardId] = useState<string>(savedCards.length > 0 ? savedCards[0].id : 'new');

   const [paymentMethodType, setPaymentMethodType] = useState<'credit_card' | 'debit_card'>(initialMethodType);
   const [installmentsOptions, setInstallmentsOptions] = useState<any[]>([]);
   const [fetchingInstallments, setFetchingInstallments] = useState(false);

   const [formData, setFormData] = useState({
      cardNumber: '',
      cardholderName: '',
      cardExpirationMonth: '',
      cardExpirationYear: '',
      securityCode: '',
      identificationType: 'CPF',
      identificationNumber: '',
      installments: '1',
      saveCard: true
   });
   
   const [brand, setBrand] = useState('unknown');

   useEffect(() => {
      // Load MercadoPago.js v2
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
         // @ts-ignore
         const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || 'TEST-00000000-0000-0000-0000-000000000000'; // Default test to avoid crash if not set in prompt
         const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
         setMpInstance(mp);
      };
      document.body.appendChild(script);
      return () => {
         document.body.removeChild(script);
      };
   }, []);

   const detectBrandAndInstallments = async (binOrBrand: string, type: 'credit_card'|'debit_card', isSavedCard = false) => {
      if (!mpInstance || (!isSavedCard && binOrBrand.length < 6)) {
          if (!isSavedCard) setBrand('unknown');
          setInstallmentsOptions([]);
          setFetchingInstallments(false);
          return;
      }
      setFetchingInstallments(true);
      try {
         const paymentMethods = isSavedCard ? null : await mpInstance.getPaymentMethods({ bin: binOrBrand });
         const method = isSavedCard ? null : (paymentMethods?.results?.find((m: any) => m.payment_type_id === type) || paymentMethods?.results?.[0]);
         
         if (method) {
             setBrand(method.id);
         } else if (!isSavedCard) {
             setBrand('unknown');
         }

         if (type === 'credit_card') {
             const payload = isSavedCard ? { amount: String(amount), payment_method_id: binOrBrand } : { amount: String(amount), bin: binOrBrand };
             const installmentsRes = await mpInstance.getInstallments(payload);
             if (installmentsRes && installmentsRes[0] && installmentsRes[0].payer_costs) {
                 setInstallmentsOptions(installmentsRes[0].payer_costs);
                 setFormData(f => ({ ...f, installments: '1' }));
             } else {
                 setInstallmentsOptions([]);
             }
         } else {
             setInstallmentsOptions([]);
             setFormData(f => ({ ...f, installments: '1' }));
         }
      } catch (e) {
         if (!isSavedCard) setBrand('unknown');
         setInstallmentsOptions([]);
      } finally {
         setFetchingInstallments(false);
      }
   };

   const isValidCardNumber = (cardNumber: string) => {
       const digits = cardNumber.replace(/\D/g, '');
       if (digits.length < 13 || digits.length > 19) return false;
       let sum = 0;
       let isEven = false;
       for (let i = digits.length - 1; i >= 0; i--) {
           let digit = parseInt(digits.charAt(i), 10);
           if (isEven) {
               digit *= 2;
               if (digit > 9) digit -= 9;
           }
           sum += digit;
           isEven = !isEven;
       }
       return (sum % 10) == 0;
   };

   const isValidCPF = (cpf: string) => {
       cpf = cpf.replace(/[^\d]+/g, '');
       if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
       let sum = 0, rest;
       for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
       rest = (sum * 10) % 11;
       if ((rest === 10) || (rest === 11)) rest = 0;
       if (rest !== parseInt(cpf.substring(9, 10))) return false;
       sum = 0;
       for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
       rest = (sum * 10) % 11;
       if ((rest === 10) || (rest === 11)) rest = 0;
       if (rest !== parseInt(cpf.substring(10, 11))) return false;
       return true;
   };

   // Formatters
   const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
       let val = e.target.value.replace(/\D/g, '');
       if (val.length >= 6) detectBrandAndInstallments(val.substring(0, 6), paymentMethodType, false);
       else {
           setBrand('unknown');
           setInstallmentsOptions([]);
       }
       
       let formatted = val;
       if (val.length > 4) formatted = val.match(/.{1,4}/g)?.join(' ') || val;
       setFormData(f => ({ ...f, cardNumber: formatted.substring(0, 19) }));
   };

   useEffect(() => {
       if (selectedCardId && selectedCardId !== 'new') {
           const sc = savedCards.find(c => c.id === selectedCardId);
           if (sc) {
               setBrand(sc.brand);
               setPaymentMethodType(sc.type);
               setFormData(f => ({
                  ...f,
                  cardNumber: sc.full_number || `•••• •••• •••• ${sc.last_four}`,
                  cardholderName: sc.holder_name,
                  cardExpirationMonth: String(sc.expiration_month).padStart(2, '0'),
                  cardExpirationYear: String(sc.expiration_year).slice(-2),
                  securityCode: '' // Still need to ask CVV for security
               }));
               detectBrandAndInstallments(sc.brand, sc.type, true);
           }
       } else {
           const bin = formData.cardNumber.replace(/\D/g, '').substring(0, 6);
           if (bin.length >= 6) {
               detectBrandAndInstallments(bin, paymentMethodType, false);
           } else {
               setInstallmentsOptions([]);
           }
       }
   }, [paymentMethodType, selectedCardId, mpInstance]);
   
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
      if (!mpInstance) return showNotification.error('MercadoPago não carregado. Verifique a chave (VITE_MERCADOPAGO_PUBLIC_KEY).');
      
      if (selectedCardId === 'new' || !selectedCardId) {
          if (!isValidCardNumber(formData.cardNumber)) {
              showNotification.error('Número do cartão inválido.');
              return;
          }
          if (!isValidCPF(formData.identificationNumber)) {
              showNotification.error('CPF inválido.');
              return;
          }
      }

      setStep('processing');
      setLoading(true);
      try {
          let tokenResult;
          let methodIdToUse = brand !== 'unknown' ? brand : undefined;

          const rawCardNumber = formData.cardNumber.replace(/\D/g, '');
          const bin = rawCardNumber.substring(0, 6);
          
          if (!methodIdToUse) {
              const paymentMethods = await mpInstance.getPaymentMethods({ bin });
              const method = paymentMethods?.results?.find((m: any) => m.payment_type_id === paymentMethodType);
              if (method) {
                  methodIdToUse = method.id;
              } else {
                  methodIdToUse = paymentMethods?.results?.[0]?.id;
              }
          }

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
          tokenResult = tokenRes.id;

          if (methodIdToUse) {
              if (paymentMethodType === 'debit_card') {
                  if (methodIdToUse === 'visa') methodIdToUse = 'debvisa';
                  else if (methodIdToUse === 'master') methodIdToUse = 'debmaster';
                  else if (methodIdToUse === 'cabal') methodIdToUse = 'debcabal';
                  else if (methodIdToUse === 'maestro') methodIdToUse = 'debmaster';
                  else if (methodIdToUse === 'elo') methodIdToUse = 'elo';
              } else if (paymentMethodType === 'credit_card') {
                  if (methodIdToUse === 'debvisa') methodIdToUse = 'visa';
                  else if (methodIdToUse === 'debmaster') methodIdToUse = 'master';
                  else if (methodIdToUse === 'debcabal') methodIdToUse = 'cabal';
              }
          }

          // Force detect final ID if still unknown but we have type
          if (!methodIdToUse || methodIdToUse === 'unknown') {
              methodIdToUse = brand;
              if (paymentMethodType === 'debit_card') {
                  if (methodIdToUse === 'visa') methodIdToUse = 'debvisa';
                  else if (methodIdToUse === 'master') methodIdToUse = 'debmaster';
              } else {
                  if (methodIdToUse === 'debvisa') methodIdToUse = 'visa';
                  else if (methodIdToUse === 'debmaster') methodIdToUse = 'master';
              }
          }

          // If saveCard is checked, save it locally (only for new cards or updating)
          if (formData.saveCard && selectedCardId === 'new') {
              saveLocalCard({
                  id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  brand: methodIdToUse || brand,
                  last_four: rawCardNumber.slice(-4),
                  expiration_month: parseInt(formData.cardExpirationMonth),
                  expiration_year: 2000 + parseInt(formData.cardExpirationYear),
                  holder_name: formData.cardholderName,
                  type: paymentMethodType,
                  full_number: rawCardNumber
              });
          }

          await processPaymentBackend({
              token: tokenResult,
              paymentMethodId: methodIdToUse
          });

      } catch (err: any) {
          console.error(err);
          showNotification.error(err.message || 'Erro ao processar cartão.');
          setStep('form');
          setLoading(false);
      }
   };



   const processPaymentBackend = async (payload: any) => {
       try {
          const res = await fetch('/api/payments/cc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  credits: itemC,
                  type: itemType,
                  token: payload.token,
                  paymentMethodId: payload.paymentMethodId,
                  installments: Number(formData.installments),
                  payerDocument: formData.identificationNumber || undefined
              })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (data.status === 'rejected') {
             let reason = 'verifique os dados do cartão';
             switch (data.status_detail) {
                 case 'cc_rejected_insufficient_amount': reason = 'saldo insuficiente na conta/cartão'; break;
                 case 'cc_rejected_bad_filled_security_code': reason = 'código de segurança (CVV) inválido'; break;
                 case 'cc_rejected_bad_filled_date': reason = 'data de validade incorreta'; break;
                 case 'cc_rejected_bad_filled_other': reason = 'dados do cartão incorretos'; break;
                 case 'cc_rejected_call_for_authorize': reason = 'cartão bloqueado, contate a operadora ou o banco'; break;
                 case 'cc_rejected_card_disabled': reason = 'cartão inativo, contate a operadora ou o banco'; break;
                 case 'cc_rejected_duplicated_payment': reason = 'pagamento duplicado, tente novamente depois'; break;
                 case 'cc_rejected_high_risk': reason = 'pagamento negado pelo sistema de segurança (fraude/risco)'; break;
                 case 'cc_rejected_invalid_installments': reason = 'número de parcelas inválido para este cartão'; break;
                 case 'cc_rejected_max_attempts': reason = 'limite de tentativas excedido'; break;
                 case 'cc_rejected_blacklist': reason = 'cartão bloqueado por segurança'; break;
             }
             throw new Error(`Pagamento recusado: ${reason}`);
          }
          
          if (data.status === 'in_process') {
               showNotification.success('Pagamento em análise!');
          }

          setStep('success');
          setTimeout(() => {
              onSuccess(data.id, data.status);
          }, 2000);
       } catch (err: any) {
          throw err;
       }
   };

   return (
      <div className="bg-card w-full max-w-md mx-auto p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-border shadow-2xl relative">
         <button onClick={onCancel} className="absolute top-6 right-6 p-2 bg-secondary rounded-full hover:bg-secondary/80 text-muted-foreground transition-all duration-200 z-20 hover:scale-110 active:scale-95"><X size={18} /></button>
         
         <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Pagamento Seguro</h2>
            <div className="text-primary font-mono text-4xl font-black mt-3 drop-shadow-sm">
                R$ {amount.toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-green-500 mt-4 opacity-80">
                <ShieldCheck size={12} strokeWidth={3} /> MercadoPago Protegido
            </div>
         </div>

         <AnimatePresence mode="wait">
            {step === 'form' && (
               <motion.div key="form" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}>
                   {savedCards.length > 0 && (
                       <div className="flex flex-col gap-3 mb-6">
                           <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Forma de Pagamento</div>
                           <div className="flex gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar -mx-2 px-2">
                               {savedCards.map(c => (
                                   <label key={c.id} className={`min-w-[160px] snap-center flex flex-col gap-2 p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${selectedCardId === c.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-secondary/50'}`}>
                                       <input type="radio" name="saved_card" className="hidden" checked={selectedCardId === c.id} onChange={() => setSelectedCardId(c.id)} />
                                       <div className="flex items-center justify-between">
                                           <div className="px-2 py-1 bg-background border border-border/50 rounded-lg text-[9px] font-black text-primary group-hover:scale-105 transition-transform">
                                              {c.brand?.replace('deb', '').toUpperCase()}
                                           </div>
                                           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedCardId === c.id ? 'border-primary bg-primary' : 'border-muted-foreground opacity-50'}`}>
                                              {selectedCardId === c.id && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50" />}
                                           </div>
                                       </div>
                                       <div className="mt-2 flex flex-col">
                                          <div className="text-sm font-mono font-bold tracking-widest">•••• {c.last_four}</div>
                                          <div className={`text-[8px] font-black mt-1 px-2 py-0.5 rounded-full w-fit ${c.type === 'debit_card' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                                             {c.type === 'debit_card' ? 'DEBITO' : 'CREDITO'}
                                          </div>
                                       </div>
                                   </label>
                               ))}
                               <label className={`min-w-[160px] snap-center flex flex-col gap-2 p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${selectedCardId === 'new' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-secondary/50'}`}>
                                   <input type="radio" name="saved_card" className="hidden" checked={selectedCardId === 'new'} onChange={() => setSelectedCardId('new')} />
                                   <div className="flex items-center justify-between">
                                       <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-muted-foreground group-hover:scale-105 transition-transform">
                                          <CreditCard size={20} />
                                       </div>
                                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedCardId === 'new' ? 'border-primary bg-primary' : 'border-muted-foreground opacity-50'}`}>
                                          {selectedCardId === 'new' && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50" />}
                                       </div>
                                   </div>
                                   <div className="text-xs font-bold mt-2">Novo Cartão</div>
                               </label>
                           </div>
                       </div>
                   )}

                   {selectedCardId === 'new' && (
                       <div className="flex bg-secondary/80 p-1.5 rounded-2xl gap-1.5 border border-border/50 mb-6">
                          <button 
                             type="button"
                             className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm ${paymentMethodType === 'credit_card' ? 'bg-background text-primary' : 'text-muted-foreground'}`}
                             onClick={() => setPaymentMethodType('credit_card')}
                          >
                             Crédito
                          </button>
                          <button 
                             type="button"
                             className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm ${paymentMethodType === 'debit_card' ? 'bg-background text-primary' : 'text-muted-foreground'}`}
                             onClick={() => setPaymentMethodType('debit_card')}
                          >
                             Débito
                          </button>
                       </div>
                   )}
                   
                   <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative">
                       {/* Animated Card Preview */}
                       {(() => {
                           const sc = selectedCardId !== 'new' ? savedCards.find(c => c.id === selectedCardId) : null;
                           const displayedBrand = (sc ? sc.brand : brand) === 'unknown' ? 'CARD' : (sc ? sc.brand : brand);
                           return (
                               <div className="w-full h-48 rounded-[2rem] bg-gradient-to-tr from-gray-950 to-gray-800 shadow-2xl overflow-hidden relative text-white p-6 flex flex-col justify-between border border-white/5 group transition-all duration-500">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />
                                  <div className="flex justify-between items-start relative z-10">
                                     <div className="w-14 h-10 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-lg flex flex-col items-center justify-center p-1 shadow-inner relative overflow-hidden">
                                         <div className="w-full h-[1px] bg-black/10 mt-1" />
                                         <div className="w-full h-[1px] bg-black/10 mt-1" />
                                         <div className="w-full h-[1px] bg-black/10 mt-1" />
                                         <div className="absolute inset-0 bg-white/10" />
                                     </div>
                                     <div className="font-extrabold italic opacity-90 text-xl uppercase tracking-tighter drop-shadow-sm">{displayedBrand}</div>
                                  </div>
                                  <div className="relative z-10">
                                     <div className="font-mono text-xl tracking-[0.2em] mb-4 drop-shadow-lg">
                                        {sc ? `•••• •••• •••• ${sc.last_four}` : (formData.cardNumber || '•••• •••• •••• ••••')}
                                     </div>
                                     <div className="flex justify-between mt-4 text-[10px] opacity-70 font-black uppercase tracking-widest font-mono">
                                         <div className="flex flex-col gap-1">
                                            <span className="opacity-50">Titular</span>
                                            <span className="text-sm truncate max-w-[180px]">{sc ? sc.holder_name : (formData.cardholderName || 'NOME DO TITULAR')}</span>
                                         </div>
                                         <div className="flex flex-col items-end gap-1">
                                            <span className="opacity-50">Validade</span>
                                            <span className="text-sm">{sc ? `${String(sc.expiration_month).padStart(2, '0')}/${sc.expiration_year}` : (formData.cardExpirationMonth ? `${formData.cardExpirationMonth}/${formData.cardExpirationYear}` : 'MM/AA')}</span>
                                         </div>
                                     </div>
                                  </div>
                               </div>
                           );
                       })()}

                       <div className="grid grid-cols-1 gap-4">
                           {selectedCardId === 'new' ? (
                               <div className="grid grid-cols-1 gap-4">
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
                                   
                                   <label className="flex items-center gap-3 mt-2 text-xs font-medium text-muted-foreground cursor-pointer group">
                                       <div className="relative">
                                          <input type="checkbox" checked={formData.saveCard} onChange={e=>setFormData(f=>({...f, saveCard: e.target.checked}))} className="peer hidden" />
                                          <div className="w-5 h-5 border-2 border-border rounded-md transition-all peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                                             <div className="w-2.5 h-1.5 border-l-2 border-b-2 border-white -rotate-45 mb-0.5" />
                                          </div>
                                       </div>
                                       Salvar cartão para pagamentos rápidos.
                                   </label>
                               </div>
                           ) : (
                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Código de Segurança (CVV)</label>
                                  <input type="text" required placeholder="000" maxLength={4} value={formData.securityCode} onChange={e => setFormData(f=>({...f, securityCode: e.target.value.replace(/\D/g, '')}))} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium text-center focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                               </div>
                           )}

                           {paymentMethodType === 'credit_card' && installmentsOptions && installmentsOptions.length > 0 ? (
                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Opções de Parcelamento</label>
                                  <select value={formData.installments} onChange={e=>setFormData(f=>({...f, installments: e.target.value}))} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer">
                                      {installmentsOptions.map((opt: any) => (
                                          <option key={opt.installments} value={opt.installments}>
                                              {opt.recommended_message}
                                          </option>
                                      ))}
                                  </select>
                               </div>
                           ) : paymentMethodType === 'credit_card' && fetchingInstallments ? (
                               <div className="w-full h-14 bg-secondary/50 border border-border/60 rounded-2xl px-5 flex items-center justify-between text-muted-foreground text-sm">
                                  <span>Carregando parcelas...</span>
                                  <Loader2 size={18} className="animate-spin text-primary opacity-50" />
                               </div>
                           ) : paymentMethodType === 'credit_card' && !fetchingInstallments && (selectedCardId !== 'new' || formData.cardNumber.length >= 16) ? (
                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Opções de Parcelamento</label>
                                  <select value={formData.installments} onChange={e=>setFormData(f=>({...f, installments: e.target.value}))} className="w-full bg-secondary/50 border border-border/60 rounded-2xl px-5 py-4 text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer">
                                      <option value="1">1x de R$ {amount.toFixed(2).replace('.', ',')} (Sem Juros)</option>
                                  </select>
                                  <div className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1 pl-1">Não foi possível carregar as opções completas. Pagamento à vista.</div>
                               </div>
                           ) : paymentMethodType === 'credit_card' ? null : (
                               <div className="w-full p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-xs text-blue-600 font-medium text-center">
                                   Pagamento à vista via Débito
                               </div>
                           )}

                       </div>
                       
                       <Button type="submit" variant="primary" className="w-full h-16 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" size={20} /> : (
                              <>
                                 <Zap size={20} className="fill-current" />
                                 Finalizar Pagamento
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
                   <h3 className="mt-6 text-lg font-bold">Processando de forma segura...</h3>
                   <p className="text-sm text-muted-foreground mt-2 px-6 text-center">Estamos comunicando com o seu banco via MercadoPago. Não feche a janela.</p>
               </motion.div>
            )}

            {step === 'success' && (
               <motion.div key="success" initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} className="flex flex-col items-center justify-center py-12 text-center text-green-500">
                   <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring", delay: 0.2}}>
                       <CheckCircle2 size={80} className="mb-4 stroke-[1.5]" />
                   </motion.div>
                   <h3 className="text-2xl font-bold">Pagamento Aprovado!</h3>
                   <p className="text-sm text-muted-foreground mt-2 text-black dark:text-white">Os créditos já estão na sua conta.</p>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}
