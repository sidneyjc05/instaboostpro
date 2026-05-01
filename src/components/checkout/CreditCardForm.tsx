import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { showNotification } from '../../context/NotificationContext';

interface Props {
  amount: number;
  originalAmount?: number;
  itemC: string | number;
  itemType: 'credits' | 'tickets' | 'plan';
  onSuccess: (paymentId: string, status: string) => void;
  onCancel: () => void;
  savedCards: any[];
  initialMethodType?: 'credit_card' | 'debit_card';
}

export function CreditCardForm({ amount, itemC, itemType, onSuccess, onCancel, savedCards, initialMethodType = 'credit_card' }: Props) {
   const [loading, setLoading] = useState(false);
   const [mpInstance, setMpInstance] = useState<any>(null);
   const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
   const [selectedCardId, setSelectedCardId] = useState<string | null>(savedCards.length > 0 ? savedCards[0].mp_card_id : 'new');

   const [paymentMethodType, setPaymentMethodType] = useState<'credit_card' | 'debit_card'>(initialMethodType);
   const [installmentsOptions, setInstallmentsOptions] = useState<any[]>([]);

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
          return;
      }
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
             }
         } else {
             setInstallmentsOptions([]);
             setFormData(f => ({ ...f, installments: '1' }));
         }
      } catch (e) {
         if (!isSavedCard) setBrand('unknown');
         setInstallmentsOptions([]);
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
           const sc = savedCards.find(c => c.mp_card_id === selectedCardId);
           if (sc) {
               setBrand(sc.brand);
               detectBrandAndInstallments(sc.brand, paymentMethodType, true);
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

          if (selectedCardId === 'new' || !selectedCardId) {
              const rawCardNumber = formData.cardNumber.replace(/\D/g, '');
              const paymentMethods = await mpInstance.getPaymentMethods({ bin: rawCardNumber.substring(0, 6) });
              const method = paymentMethods?.results?.find((m: any) => m.payment_type_id === paymentMethodType);
              if (method) {
                  methodIdToUse = method.id;
              } else if (!methodIdToUse) {
                  methodIdToUse = paymentMethods?.results?.[0]?.id;
              }
              const tokenRes = await mpInstance.createCardToken({
                  cardNumber: rawCardNumber,
                  cardholderName: formData.cardholderName,
                  cardExpirationMonth: formData.cardExpirationMonth,
                  cardExpirationYear: `20${formData.cardExpirationYear}`, // assuming YY
                  securityCode: formData.securityCode,
                  identificationType: formData.identificationType,
                  identificationNumber: formData.identificationNumber.replace(/\D/g, '')
              });

              if (!tokenRes || !tokenRes.id) throw new Error('Erro ao gerar token do cartão.');
              tokenResult = tokenRes.id;
          } else {
              const tokenRes = await mpInstance.createCardToken({
                  cardId: selectedCardId,
                  securityCode: formData.securityCode
              });
              
              if (!tokenRes || !tokenRes.id) throw new Error('Erro ao gerar token seguro.');
              tokenResult = tokenRes.id;
              
              const sc = savedCards.find(c => c.mp_card_id === selectedCardId);
              if (sc) methodIdToUse = sc.brand;
          }

          if (methodIdToUse) {
              if (paymentMethodType === 'debit_card') {
                  if (methodIdToUse === 'visa') methodIdToUse = 'debvisa';
                  else if (methodIdToUse === 'master') methodIdToUse = 'debmaster';
                  else if (methodIdToUse === 'cabal') methodIdToUse = 'debcabal';
                  else if (methodIdToUse === 'elo') methodIdToUse = 'elo'; // Elo debit uses same id
              } else if (paymentMethodType === 'credit_card') {
                  if (methodIdToUse === 'debvisa') methodIdToUse = 'visa';
                  else if (methodIdToUse === 'debmaster') methodIdToUse = 'master';
                  else if (methodIdToUse === 'debcabal') methodIdToUse = 'cabal';
              }
          }

          await processPaymentBackend({
              token: tokenResult,
              cardId: selectedCardId === 'new' ? null : selectedCardId,
              capture: selectedCardId === 'new' ? formData.saveCard : false,
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
                  cardId: payload.cardId,
                  capture: payload.capture,
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
      <div className="bg-card w-full max-w-md mx-auto p-6 rounded-3xl border shadow-xl relative overflow-hidden">
         <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-secondary rounded-full hover:bg-secondary/80 text-muted-foreground"><X size={16} /></button>
         
         <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Resumo do Pagamento</h2>
            <div className="text-primary font-mono text-3xl font-black mt-2">
                R$ {amount.toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-green-500 mt-1">
                <ShieldCheck size={14} /> Pagamento Seguro via MercadoPago
            </div>
         </div>

         <AnimatePresence mode="wait">
            {step === 'form' && (
               <motion.div key="form" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}>
                   {selectedCardId === 'new' && (
                       <div className="flex bg-secondary p-1 rounded-xl mb-4">
                          <button 
                             type="button"
                             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${paymentMethodType === 'credit_card' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                             onClick={() => setPaymentMethodType('credit_card')}
                          >
                             Crédito
                          </button>
                          <button 
                             type="button"
                             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${paymentMethodType === 'debit_card' ? 'bg-background shadow-sm text-blue-500' : 'text-muted-foreground'}`}
                             onClick={() => setPaymentMethodType('debit_card')}
                          >
                             Débito
                          </button>
                       </div>
                   )}
                   
                   <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
                       {savedCards.length > 0 && (
                           <div className="flex flex-col gap-2 mb-2">
                               <div className="text-sm font-semibold">Selecione uma opção de pagamento:</div>
                               <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                                   {savedCards.map(c => (
                                       <label key={c.id} className={`min-w-[140px] snap-center flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition ${selectedCardId === c.mp_card_id ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}`}>
                                           <input type="radio" name="saved_card" className="hidden" checked={selectedCardId === c.mp_card_id} onChange={() => setSelectedCardId(c.mp_card_id)} />
                                           <div className="flex items-center justify-between">
                                               <div className="w-8 h-6 bg-white rounded flex flex-col items-center justify-center font-bold text-[10px] text-black">
                                                  {c.brand?.replace('deb', '').toUpperCase()}
                                               </div>
                                               <div className={`w-4 h-4 rounded-full border-2 ${selectedCardId === c.mp_card_id ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                           </div>
                                           <div className="text-xs font-medium mt-1 flex items-center justify-between">
                                              <span>•••• {c.last_four}</span>
                                              <span className="text-[9px] font-bold text-muted-foreground ml-1">{c.brand?.startsWith('deb') ? 'DÉB' : 'CRÉD'}</span>
                                           </div>
                                       </label>
                                   ))}
                                   <label className={`min-w-[140px] snap-center flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition ${selectedCardId === 'new' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}`}>
                                       <input type="radio" name="saved_card" className="hidden" checked={selectedCardId === 'new'} onChange={() => setSelectedCardId('new')} />
                                       <div className="flex items-center justify-between">
                                           <div className="w-8 h-6 bg-secondary rounded flex items-center justify-center text-muted-foreground">
                                              <CreditCard size={14} />
                                           </div>
                                           <div className={`w-4 h-4 rounded-full border-2 ${selectedCardId === 'new' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                       </div>
                                       <div className="text-xs font-medium mt-1">Novo Cartão</div>
                                   </label>
                               </div>
                           </div>
                       )}

                       {/* Animated Card Preview */}
                       {(() => {
                           const sc = selectedCardId !== 'new' ? savedCards.find(c => c.mp_card_id === selectedCardId) : null;
                           return (
                               <div className="w-full h-44 rounded-2xl bg-gradient-to-tr from-gray-900 to-gray-700 shadow-xl overflow-hidden relative text-white p-5 flex flex-col justify-between">
                                  <div className="flex justify-between items-start">
                                     <div className="w-12 h-8 bg-yellow-400/80 rounded flex items-end justify-start p-1 outline outline-1 outline-yellow-500/50">
                                         <div className="w-3 h-4 border-r border-black/20" />
                                         <div className="w-3 h-4 border-r border-black/20" />
                                     </div>
                                     <div className="font-bold italic opacity-80 text-lg uppercase">{(sc ? sc.brand : brand) === 'unknown' ? 'CARD' : (sc ? sc.brand : brand)}</div>
                                  </div>
                                  <div>
                                     <div className="font-mono text-lg tracking-widest opacity-90">{sc ? `•••• •••• •••• ${sc.last_four}` : (formData.cardNumber || '•••• •••• •••• ••••')}</div>
                                     <div className="flex justify-between mt-2 text-xs opacity-75 font-medium uppercase font-mono">
                                         <span>{sc ? 'CADASTRADO' : (formData.cardholderName || 'NOME DO TITULAR')}</span>
                                         <span>{sc ? `${sc.expiration_month}/${sc.expiration_year}` : (formData.cardExpirationMonth ? `${formData.cardExpirationMonth}/${formData.cardExpirationYear}` : 'MM/AA')}</span>
                                     </div>
                                  </div>
                               </div>
                           );
                       })()}

                       <div className="grid grid-cols-1 gap-3 relative z-10">

                           {selectedCardId === 'new' ? (
                               <>
                                   <div className="relative">
                                       <input type="text" required placeholder="Número do Cartão" value={formData.cardNumber} onChange={handleCardNumber} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                                   </div>
                                   <input type="text" required placeholder="Nome Impresso no Cartão" value={formData.cardholderName} onChange={e => setFormData(f=>({...f, cardholderName: e.target.value.toUpperCase()}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                                   <div className="grid grid-cols-2 gap-3">
                                       <input type="text" required placeholder="Validade (MM/AA)" value={`${formData.cardExpirationMonth}${formData.cardExpirationMonth && !formData.cardExpirationYear ? '/' : ''}${formData.cardExpirationYear ? `/${formData.cardExpirationYear}` : ''}`} onChange={handleExpiry} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                                       <input type="text" required placeholder="CVV" maxLength={4} value={formData.securityCode} onChange={e => setFormData(f=>({...f, securityCode: e.target.value.replace(/\D/g, '')}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                                   </div>
                                   <input type="text" required placeholder="CPF do Titular" value={formData.identificationNumber} onChange={handleCpf} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                                   
                                   <label className="flex items-center gap-2 mt-2 text-sm text-muted-foreground cursor-pointer">
                                       <input type="checkbox" checked={formData.saveCard} onChange={e=>setFormData(f=>({...f, saveCard: e.target.checked}))} className="rounded border-border bg-secondary text-primary accent-primary w-4 h-4" />
                                       Salvar cartão para pagamentos rápidos.
                                   </label>
                               </>
                           ) : (
                               <div className="grid grid-cols-1 gap-3">
                                   <input type="text" required placeholder="Código de Segurança (CVV)" maxLength={4} value={formData.securityCode} onChange={e => setFormData(f=>({...f, securityCode: e.target.value.replace(/\D/g, '')}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition" />
                               </div>
                           )}
                           {paymentMethodType === 'credit_card' && installmentsOptions && installmentsOptions.length > 0 ? (
                               <select value={formData.installments} onChange={e=>setFormData(f=>({...f, installments: e.target.value}))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition appearance-none">
                                   {installmentsOptions.map((opt: any) => (
                                       <option key={opt.installments} value={opt.installments}>
                                           {opt.recommended_message}
                                       </option>
                                   ))}
                               </select>
                           ) : paymentMethodType === 'credit_card' && (selectedCardId !== 'new' || formData.cardNumber.length >= 16) ? (
                               <div className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center justify-between">
                                  <span>Carregando parcelas...</span>
                                  <Loader2 size={16} className="animate-spin" />
                               </div>
                           ) : paymentMethodType === 'credit_card' ? null : (
                               <div className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
                                   Pagamento à vista (Débito) - R$ {amount.toFixed(2).replace('.', ',')}
                               </div>
                           )}

                       </div>
                       
                       <Button type="submit" variant="primary" className="w-full py-6 mt-2 relative overflow-hidden" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" /> : 'Pagar Agora'}
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
