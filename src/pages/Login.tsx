import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { showNotification } from '../context/NotificationContext';
import { Instagram, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(!searchParams.get('register'));
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
     if (searchParams.get('register')) {
        setIsLogin(false);
     }
  }, [searchParams]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showNotification.success('E-mail de recuperação enviado com sucesso!');
      setForgotMode(false);
    } catch (err: any) {
      console.error(err);
      showNotification.error('Erro ao enviar e-mail. Verifique se o e-mail está correto.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        // Firebase Auth usa email para login. Se o usuário digitou username, 
        // seria necessário buscar o email no Firestore antes, mas vamos focar em email no Firebase.
        const loginEmail = email || username; // Permitindo que ele use o campo username como email se quiser
        if (!loginEmail.includes('@')) {
           throw new Error("Por favor, use seu E-mail cadastrado para fazer login.");
        }
        await signInWithEmailAndPassword(auth, loginEmail, password);
        await refreshUser();
        showNotification.success('Autenticação concluída!');
      } else {
        if (!email.includes('@')) {
           throw new Error("Por favor, forneça um e-mail válido.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Criar perfil no Firestore
        await setDoc(doc(db, "users", user.uid), {
           username,
           email,
           role: 'user',
           is_verified: false,
           is_blocked: false,
           credits: 0,
           tickets: 0,
           created_at: new Date().toISOString()
        });

        await refreshUser();
        showNotification.success('Conta criada com sucesso!');
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      showNotification.error(err.message || 'Erro na autenticação. Verifique os dados.');
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
           <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-[0_0_25px_rgba(139,92,246,0.4)]">
             <Instagram size={32} />
           </div>
          <h1 className="text-2xl font-extrabold tracking-tight">InstaBoost <span className="text-primary">PRO</span></h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {forgotMode ? 'Recuperação de Conta' : 'Conecte-se para começar'}
          </p>
        </div>

        {forgotMode ? (
           <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
               <p className="text-sm text-center text-muted-foreground mb-2">
                  Digite seu e-mail cadastrado para redefinir a senha.
               </p>
               <Input 
                 type="email"
                 placeholder="Seu E-mail" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
               />
               <Button type="submit" isLoading={loading} className="w-full mt-2">
                  Enviar E-mail de Recuperação
               </Button>
               <div className="mt-4 text-center">
                 <button 
                   type="button"
                   className="text-sm font-bold text-muted-foreground hover:underline focus:outline-none"
                   onClick={() => setForgotMode(false)}
                 >
                   Voltar ao Login
                 </button>
               </div>
           </form>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
             <motion.div key="auth" exit={{ opacity: 0 }} className="flex flex-col gap-4">
                {!isLogin && (
                  <Input 
                    placeholder="Nome de usuário (Ex: @seu_insta)" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={!isLogin}
                  />
                )}
                <Input 
                  type="email"
                  placeholder="Seu E-mail" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
          </AnimatePresence>
          
          <Button type="submit" isLoading={loading} className="w-full mt-2">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>
        </form>
        )}

        {!forgotMode && (
           <>
             <p className="mt-6 text-center text-sm text-muted-foreground">
               {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
               <button 
                 type="button" 
                 onClick={() => {
                   setIsLogin(!isLogin);
                 }} 
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
      </motion.div>
    </div>
  );
}
