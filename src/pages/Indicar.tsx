import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { X, Sparkles, Coins, Users, Gift } from 'lucide-react';
import { Zap } from 'lucide-react';

export default function Indicar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(searchParams.get('ref') || '');
  
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMedian = /Median/i.test(navigator.userAgent);
  const isFallback = searchParams.get('fallback') === '1';

  useEffect(() => {
    if (searchParams.get('ref')) {
      localStorage.setItem('referral_code', searchParams.get('ref') || '');
    }

    if (searchParams.get('ref') && isAndroid && !isMedian && !isFallback) {
      if (!sessionStorage.getItem('app_launch_attempted')) {
        sessionStorage.setItem('app_launch_attempted', 'true');
        const currentUrl = window.location.href;
        const noProtocolUrl = currentUrl.replace(/^https?:\/\//, '');
        
        let fallbackUrl = currentUrl;
        if (fallbackUrl.includes('?')) {
          fallbackUrl += '&fallback=1';
        } else {
          fallbackUrl += '?fallback=1';
        }

        const intentUrl = `intent://${noProtocolUrl}#Intent;scheme=https;package=co.median.android.xlpqlnd;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
        // Try auto launch, though browser might block it
        window.location.replace(intentUrl);
      }
    }
  }, [searchParams, isAndroid, isMedian, isFallback]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (code) {
        localStorage.setItem('referral_code', code);
      } else {
        localStorage.removeItem('referral_code');
      }
      navigate('/login?register=1');
    }
  };

  const handleClose = () => {
    // If they close, they can still sign up without it or claim later
    navigate('/login?register=1');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute -top-[100px] -right-[100px] w-[300px] h-[300px] bg-purple-600/30 blur-[120px] rounded-full" />
         <div className="absolute -bottom-[100px] -left-[100px] w-[300px] h-[300px] bg-blue-600/30 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <button onClick={handleClose} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition">
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="popLayout">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-tr from-purple-600 to-blue-500 p-4 shadow-xl shadow-purple-500/20 flex items-center justify-center">
                <Zap className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold font-space text-white mb-4">
                Seja bem-vindo ao<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">InstaBoost PRO</span>!
              </h1>
              <p className="text-white/60 mb-8 max-w-[280px]">
                A plataforma que vai acelerar o seu crescimento no Instagram de forma real e orgânica.
              </p>
              
              {isAndroid && !isMedian && !isFallback && (
                <Button 
                  onClick={() => {
                    const currentUrl = window.location.href;
                    const noProtocolUrl = currentUrl.replace(/^https?:\/\//, '');
                    
                    let fallbackUrl = currentUrl;
                    if (fallbackUrl.includes('?')) {
                      fallbackUrl += '&fallback=1';
                    } else {
                      fallbackUrl += '?fallback=1';
                    }

                    const intentUrl = `intent://${noProtocolUrl}#Intent;scheme=https;package=co.median.android.xlpqlnd;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
                    window.location.href = intentUrl;
                  }} 
                  size="lg" 
                  className="w-full h-14 text-lg bg-green-600 hover:bg-green-500 mb-4 animate-bounce"
                >
                  Abrir no Aplicativo Oficial
                </Button>
              )}

              <Button onClick={handleNext} size="lg" className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                {isAndroid && !isMedian && !isFallback ? "Continuar pelo navegador" : "Continuar"}
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold font-space text-white mb-2">Como Funciona</h2>
                <p className="text-white/60 text-sm">Cresça junto com a comunidade</p>
              </div>

              <div className="space-y-4">
                <div className="flex bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mr-4 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Missões Diárias</h3>
                    <p className="text-white/60 text-sm">Curta, siga e assista para ganhar moedas se divertindo.</p>
                  </div>
                </div>
                
                <div className="flex bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mr-4 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Impulsione</h3>
                    <p className="text-white/60 text-sm">Use suas moedas para divulgar seus próprios posts e perfil.</p>
                  </div>
                </div>

                <div className="flex bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mr-4 shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Recompensas</h3>
                    <p className="text-white/60 text-sm">Gire a roleta e ganhe prêmios incríveis subindo de rank.</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleNext} size="lg" className="w-full h-14 text-lg bg-white text-black hover:bg-neutral-200 mt-2">
                Entendi, continuar
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center mb-6">
                 <Users className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold font-space text-white mb-2 text-center">Código de Indicação</h2>
              <p className="text-white/60 text-center mb-6 px-4">
                {searchParams.get('ref') ? (
                   <>Você foi indicado! Confirme o código abaixo e crie sua conta para receber <strong className="text-yellow-400 font-bold">1.000 moedas</strong> de presente!</>
                ) : (
                   <>Tem um código de indicação? Insira abaixo para receber <strong className="text-yellow-400 font-bold">1.000 moedas</strong> de presente ao criar sua conta!</>
                )}
              </p>

              <div className="w-full space-y-4 mb-8">
                <Input 
                   value={code}
                   onChange={e => setCode(e.target.value.toUpperCase())}
                   placeholder={searchParams.get('ref') ? "Digite o código" : "Código (opcional)"}
                   className="h-14 text-center text-lg font-bold tracking-widest uppercase bg-white/5 border-white/10 text-white focus-visible:ring-purple-500"
                />
              </div>

              <Button onClick={handleNext} size="lg" className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                {code ? "Resgatar e Criar Conta" : "Criar Conta sem Código"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
