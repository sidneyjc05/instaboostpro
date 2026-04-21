import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Heart, UserPlus, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Promotion {
  id: number;
  url: string;
  user_id: number;
  username: string;
  expires_at: string;
}

const getInstaLinkType = (link: string) => {
  if (!link) return 'profile';
  return /\/(p|reel|tv)\//i.test(link) ? 'post' : 'profile';
};

const InstaPreview = ({ url, type, username }: { url: string, type: string, username: string }) => {
  const cleanUrl = url.split('?')[0].replace(/\/$/, "");

  if (type === 'post') {
     return (
       <div className="w-full bg-white rounded-xl overflow-hidden shadow-sm border border-border mt-3 pointer-events-none relative">
         {/* Pointer events none to prevent interacting inside the iframe without tracking */}
         <div className="absolute inset-0 z-10"></div>
         <iframe 
           src={`${cleanUrl}/embed`} 
           width="100%" 
           height="340" 
           frameBorder="0" 
           scrolling="no" 
           allowTransparency={true}
           className="w-full bg-white"
         ></iframe>
       </div>
     );
  } else {
    // Profile - extract username
    const usernameMatch = cleanUrl.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
    const profileUser = usernameMatch ? usernameMatch[1] : username;
    return (
       <div className="w-full bg-secondary/30 rounded-xl p-6 flex flex-col items-center justify-center text-center border border-border mt-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-1 mb-3">
             <div className="w-full h-full bg-card rounded-full flex items-center justify-center text-2xl font-bold uppercase text-white">
                {profileUser.charAt(0)}
             </div>
          </div>
          <h3 className="font-bold text-lg text-foreground">@{profileUser}</h3>
          <p className="text-sm text-muted-foreground mt-1">Conta do Instagram</p>
       </div>
    );
  }
};

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, refreshUser } = useAuth();

  const loadPromos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promotions');
      if (res.ok) {
        setPromotions(await res.json());
      }
    } catch {
      showNotification.error('Erro ao carregar feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleInteract = async (id: number) => {
    try {
      const res = await fetch(`/api/promotions/${id}/interact`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showNotification.success(`Você ganhou ${data.reward} moedas!`);
        // Remove from list
        setPromotions(prev => prev.filter(p => p.id !== id));
        refreshUser();
      } else {
        if (data.error === 'CANT_INTERACT_OWN') {
          showNotification.error('Você não pode interagir com a própria divulgação!');
        } else {
          showNotification.error(data.error);
        }
      }
    } catch {
      showNotification.error('Erro ao interagir');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">InstaBoost <span className="text-primary">PRO</span></h1>
          <p className="text-muted-foreground mt-1 text-sm">Ganhe créditos interagindo com a comunidade</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2 shadow-sm">
             💎 {Number((user?.credits || 0).toFixed(1))} Moedas
          </div>
          <button onClick={loadPromos} className="p-2 bg-secondary rounded-full hover:bg-muted text-muted-foreground hover:text-foreground relative group">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
         <div className="flex items-start gap-3 relative z-10">
           <ShieldCheck className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" size={24} />
           <div className="flex flex-col gap-2">
             <h3 className="font-bold text-blue-700 dark:text-blue-200">Termos e Boas Práticas</h3>
             <ul className="text-sm text-blue-900 dark:text-blue-100/80 space-y-2 list-disc ml-4">
               <li>
                 <strong className="text-blue-950 dark:text-blue-100">Para Interagir:</strong> Recomendamos o uso de uma conta secundária ("fake") de Instagram para seguir e curtir outras pessoas. Assim, sua conta oficial fica protegida de bloqueios.
               </li>
               <li>
                 <strong className="text-blue-950 dark:text-blue-100">Para Receber Interações:</strong> O perfil que você impulsionar **deve ser PÚBLICO**. Links de contas privadas ou posts fechados causarão falha na pré-visualização, e outras pessoas não conseguirão interagir.
               </li>
             </ul>
           </div>
         </div>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          Divulgações Disponíveis
        </h3>
        <div className="grid gap-6">
        <AnimatePresence>
          {loading && promotions.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 bg-secondary animate-pulse rounded-2xl border border-border"></div>
            ))
          ) : promotions.length === 0 ? (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="text-center p-12 bg-secondary/50 rounded-3xl border border-border"
            >
              <p className="text-muted-foreground">Nenhuma divulgação nova no momento.</p>
              <p className="text-xs mt-2 opacity-60">Volte mais tarde ou crie a sua!</p>
            </motion.div>
          ) : (
            promotions.map((p, i) => {
              const isPost = getInstaLinkType(p.url) === 'post';
              
              return (
              <motion.div 
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 bg-card rounded-2xl border border-border shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center flex-shrink-0 justify-center text-white font-bold text-xs ${isPost ? 'bg-zinc-800 border-blue-400' : 'bg-zinc-800 border-green-400'}`}>
                    {p.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">@{p.username}</span>
                    <span className="text-xs text-muted-foreground">{isPost ? 'Divulgação de Postagem' : 'Divulgação de Perfil'}</span>
                  </div>
                  <span className="text-green-400 font-bold ml-auto bg-green-400/10 px-2 py-1 rounded-md text-sm">
                    +0.2 💎
                  </span>
                </div>

                <InstaPreview url={p.url} type={isPost ? 'post' : 'profile'} username={p.username} />
                
                <div className="flex gap-3 pt-2 mt-1">
                  <Button 
                    variant="secondary" 
                    className={`flex-1 flex gap-2 text-white shadow-md font-bold text-base py-6 ${isPost ? 'bg-blue-500 hover:bg-blue-600' : 'bg-pink-500 hover:bg-pink-600'}`}
                    onClick={() => {
                      window.open(p.url, '_blank', 'noopener,noreferrer');
                      handleInteract(p.id);
                    }}
                    disabled={user?.id === p.user_id}
                  >
                    {isPost ? <Heart size={20} /> : <UserPlus size={20} />} 
                    {isPost ? 'Curtir' : 'Seguir'}
                  </Button>
                </div>
              </motion.div>
            )})
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
