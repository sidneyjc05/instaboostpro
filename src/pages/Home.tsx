import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Heart, UserPlus, RefreshCw } from 'lucide-react';
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
        showNotification.success(`Você ganhou ${data.reward} créditos!`);
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">InstaBoost <span className="text-primary">PRO</span></h1>
          <p className="text-muted-foreground mt-1 text-sm">Ganhe créditos interagindo com a comunidade</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2 shadow-sm">
             💎 {Number((user?.credits || 0).toFixed(1))} Créditos
          </div>
          <button onClick={loadPromos} className="p-2 bg-secondary rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-4">Divulgações Disponíveis</h3>
        <div className="grid gap-4">
        <AnimatePresence>
          {loading && promotions.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-secondary animate-pulse rounded-2xl border border-border"></div>
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
                  <span className="text-green-400 font-bold ml-auto">
                    +5
                  </span>
                </div>
                
                <div className="flex gap-3 pt-2 mt-2">
                  <Button 
                    variant="secondary" 
                    className={`flex-1 flex gap-2 text-white shadow-md ${isPost ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'}`}
                    onClick={() => {
                      window.open(p.url, '_blank', 'noopener,noreferrer');
                      handleInteract(p.id);
                    }}
                    disabled={user?.id === p.user_id}
                  >
                    {isPost ? <Heart size={18} /> : <UserPlus size={18} />} 
                    {isPost ? 'Acessar e Curtir' : 'Acessar e Seguir'}
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
