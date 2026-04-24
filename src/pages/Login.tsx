import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { OTPInput } from '../components/ui/OTPInput';
import { showNotification } from '../context/NotificationContext';
import { Instagram, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = enter email, 2 = enter code & generic new password

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
       if (forgotStep === 1) {
          const res = await fetch('/api/auth/recover/send', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (res.ok) {
             showNotification.success('Se o e-mail estiver cadastrado, um código foi enviado.');
             setForgotStep(2);
          } else {
             showNotification.error(data.error);
          }
       } else {
          const res = await fetch('/api/auth/recover/reset', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ email, code: verificationCode, newPassword: password })
          });
          const data = await res.json();
          if (res.ok) {
             showNotification.success('Senha atualizada com sucesso! Faça login.');
             setForgotMode(false);
             setIsLogin(true);
             setPassword('');
             setVerificationCode('');
          } else {
             showNotification.error(data.error);
          }
       }
    } catch {
       showNotification.error('Erro de conexão');
    } finally {
       setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
         ? { username, password, verificationCode } 
         : { username, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (res.ok) {
        showNotification.success(isLogin ? 'Autenticação concluída!' : 'Conta criada com sucesso!');
        await refreshUser();
      } else {
        if (data.requiresVerification) {
           setRequiresVerification(true);
           showNotification.error(data.error);
        } else {
           showNotification.error(data.error || 'Ocorreu um erro');
        }
      }
    } catch (err) {
      showNotification.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm p-6 bg-card rounded-3xl shadow-xl border border-border"
      >
        <div className="flex flex-col items-center mb-8">
           {requiresVerification || forgotMode ? (
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-[0_0_25px_rgba(249,115,22,0.4)]">
                 <ShieldAlert size={32} />
              </div>
           ) : (
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-[0_0_25px_rgba(139,92,246,0.4)]">
                <Instagram size={32} />
              </div>
           )}
          <h1 className="text-2xl font-extrabold tracking-tight">InstaBoost <span className="text-primary">PRO</span></h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {requiresVerification 
                ? 'Verificação de Segurança Restrita' 
                : forgotMode ? 'Recuperação de Conta' : 'Conecte-se para começar'
            }
          </p>
        </div>

        {forgotMode ? (
           <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                 {forgotStep === 1 ? (
                    <motion.div exit={{ opacity: 0 }} className="flex flex-col gap-4">
                       <p className="text-sm text-center text-muted-foreground mb-2">
                          Digite seu e-mail cadastrado. Se ele existir na nossa base, enviaremos um código.
                       </p>
                       <Input 
                         type="email"
                         placeholder="Seu E-mail" 
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         required
                       />
                       <Button type="submit" isLoading={loading} className="w-full mt-2">
                          Enviar Código
                       </Button>
                    </motion.div>
                 ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-4">
                       <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-300 text-sm rounded-xl text-center">
                          Código enviado! Verifique seu E-mail.
                       </div>
                       <OTPInput value={verificationCode} onChange={setVerificationCode} />
                       <Input 
                          type="password"
                          placeholder="Nova Senha" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                       />
                       <Button type="submit" isLoading={loading} className="w-full mt-2">
                          Redefinir Senha
                       </Button>
                    </motion.div>
                 )}
              </AnimatePresence>
              <div className="mt-4 text-center">
                <button 
                  type="button"
                  className="text-sm font-bold text-muted-foreground hover:underline focus:outline-none"
                  onClick={() => {
                     setForgotMode(false);
                     setForgotStep(1);
                     setVerificationCode('');
                     setPassword('');
                  }}
                >
                  Voltar ao Login
                </button>
              </div>
           </form>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {requiresVerification ? (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-5">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-300 text-sm rounded-xl text-center">
                     Detectamos um novo dispositivo. Enviamos um código para seu email de recuperação. Verifique sua caixa de entrada.
                     <br/><br/>
                     <span className="font-bold">Aviso:</span> Pode demorar até 10 minutos para chegar o código. Tenha paciência e evite enviar vários códigos em sequência!
                  </div>
                  <OTPInput 
                     value={verificationCode}
                     onChange={setVerificationCode}
                  />
               </motion.div>
            ) : (
               <motion.div exit={{ opacity: 0 }} className="flex flex-col gap-4">
                  <Input 
                    placeholder="Nome de usuário ou E-mail" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  {!isLogin && (
                    <div className="flex flex-col gap-1">
                      <Input 
                        type="email"
                        placeholder="E-mail" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground ml-1">
                         Opcional. Extremamente recomendado para recuperar a conta e essencial se for o primeiro usuário (Admin) do sistema.
                      </p>
                    </div>
                  )}
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Senha" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button 
                       type="button" 
                       onClick={() => setShowPassword(!showPassword)}
                       className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 focus:outline-none"
                    >
                       {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
               </motion.div>
            )}
          </AnimatePresence>
          
          <Button type="submit" isLoading={loading} className="w-full mt-2">
            {requiresVerification ? 'Validar Código' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </Button>
        </form>
        )}

        {!requiresVerification && !forgotMode && (
           <>
             <p className="mt-6 text-center text-sm text-muted-foreground">
               {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
               <button 
                 type="button" 
                 onClick={() => setIsLogin(!isLogin)} 
                 className="ml-1 text-primary hover:underline font-medium"
               >
                 {isLogin ? 'Cadastre-se' : 'Faça login'}
               </button>
             </p>
             {isLogin && (
               <div className="mt-4 text-center">
                 <button 
                   type="button"
                   onClick={() => setForgotMode(true)}
                   className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                 >
                   Esqueci minha senha
                 </button>
               </div>
             )}
           </>
        )}
        {requiresVerification && (
           <div className="mt-4 text-center">
             <button 
               className="text-sm font-bold text-muted-foreground hover:underline focus:outline-none"
               onClick={() => {
                  setRequiresVerification(false);
                  setVerificationCode('');
               }}
             >
               Voltar
             </button>
           </div>
        )}
      </motion.div>
    </div>
  );
}
