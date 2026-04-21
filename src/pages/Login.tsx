import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { showNotification } from '../context/NotificationContext';
import { Instagram, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

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
           showNotification.warning(data.error);
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
           {requiresVerification ? (
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
            {requiresVerification ? 'Verificação de Segurança Restrita' : 'Conecte-se para começar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {requiresVerification ? (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-3">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-300 text-sm rounded-xl text-center">
                     Detectamos um novo dispositivo. Enviamos um código para seu email de recuperação. Verifique sua caixa de entrada.
                  </div>
                  <Input 
                     placeholder="Código de Verificação de 6 dígitos" 
                     value={verificationCode}
                     onChange={(e) => setVerificationCode(e.target.value)}
                     maxLength={6}
                     required
                     className="text-center font-mono text-lg tracking-widest"
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
                    <Input 
                      type="email"
                      placeholder="E-mail" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  )}
                  <Input 
                    type="password" 
                    placeholder="Senha" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
               </motion.div>
            )}
          </AnimatePresence>
          
          <Button type="submit" isLoading={loading} className="w-full mt-2">
            {requiresVerification ? 'Validar Código' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </Button>
        </form>

        {!requiresVerification && (
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
