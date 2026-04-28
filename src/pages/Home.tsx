import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Heart, UserPlus, RefreshCw, ShieldCheck, Gift, Target, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { MissionsTab } from '../components/MissionsTab';
import { InstaViewerModal } from '../components/InstaViewerModal';

interface Promotion {
  id: number;
  url: string;
  user_id: number;
  username: string;
  expires_at: string;
}

const getInstaLinkType = (link: string) => {
  if (!link) return 'profile';
  if (link.includes('/reel/')) return 'reel';
  return /\/(p|tv)\//i.test(link) ? 'post' : 'profile';
};

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, refreshUser } = useAuth();
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [hasDailyRewardAvailable, setHasDailyRewardAvailable] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'missions' | 'feed'>('missions');
  
  // Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);

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

  const checkDailyRewards = async () => {
    try {
      const res = await fetch('/api/rewards/daily');
      if (res.ok) {
        const data = await res.json();
        const available = data.plan?.some((p: any) => p.state === 'available');
        setHasDailyRewardAvailable(available);
        if (available) {
           setShowDailyModal(true);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadPromos();
    checkDailyRewards();
  }, []);

  const handleInteract = async () => {
    if (!activePromo) return;
    try {
      const res = await fetch(`/api/promotions/${activePromo.id}/interact`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showNotification.success(`Você ganhou ${data.reward} moedas!`);
        setPromotions(prev => prev.filter(p => p.id !== activePromo.id));
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
    } finally {
      setViewerOpen(false);
      setActivePromo(null);
    }
  };

  const openViewer = (promo: Promotion) => {
     if (user?.id === promo.user_id) {
         showNotification.error('Você não pode interagir com a própria divulgação!');
         return;
     }
     setActivePromo(promo);
     setViewerOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-xl mx-auto w-full">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <button 
           onClick={() => setShowDailyModal(true)}
           className={`relative overflow-hidden w-full text-left rounded-2xl p-5 border flex items-center justify-between transition-all shadow-sm ${hasDailyRewardAvailable ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/40 hover:from-yellow-500/30 hover:to-orange-500/30' : 'bg-secondary/50 border-border hover:bg-secondary'}`}
         >
            <div className="flex items-center gap-4 relative z-10">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasDailyRewardAvailable ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg' : 'bg-card text-muted-foreground border'}`}>
                  <Gift size={24} />
               </div>
               <div>
                  <h3 className={`font-bold ${hasDailyRewardAvailable ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>Prêmio Diário</h3>
                  <p className="text-sm text-muted-foreground">
                     {hasDailyRewardAvailable ? '🎁 Resgate o prêmio de hoje!' : 'Ver calendário da semana'}
                  </p>
               </div>
            </div>
            {hasDailyRewardAvailable && (
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
               </span>
            )}
         </button>

         <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden h-full justify-center">
            <div className="flex items-start gap-3 relative z-10">
              <ShieldCheck className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
              <div className="flex flex-col">
                <h3 className="font-extrabold text-sm text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 animate-pulse">Termos e Dicas</h3>
                <p className="text-xs text-blue-900/90 dark:text-blue-100/90 font-medium mt-1">
                  Use "fakes" para interagir. Seus perfis devem ser <b>Públicos</b>.
                </p>
              </div>
            </div>
         </div>
      </div>

      <div className="bg-secondary/40 p-1 rounded-xl flex">
        <button 
          onClick={() => setActiveTab('missions')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'missions' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Target size={18} className={activeTab === 'missions' ? 'text-primary' : ''} />
          Missões
        </button>
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'feed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <RefreshCw size={18} className={activeTab === 'feed' ? 'text-primary' : ''} />
          Feed Geral
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'missions' ? (
           <motion.div 
             key="missions"
             initial={{ opacity: 0, x: -10 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -10 }}
             transition={{ duration: 0.2 }}
           >
             <MissionsTab onGoToFeed={() => setActiveTab('feed')} />
           </motion.div>
        ) : (
           <motion.div 
             key="feed"
             initial={{ opacity: 0, x: 10 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 10 }}
             transition={{ duration: 0.2 }}
             className="flex flex-col gap-6"
           >
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
                      const linkType = getInstaLinkType(p.url);
                      const isContent = linkType === 'post' || linkType === 'reel';
                      const promoTypeLabel = linkType === 'post' ? 'Divulgação de Postagem' : (linkType === 'reel' ? 'Divulgação de Reel' : 'Divulgação de Perfil');
                      
                      return (
                      <motion.div 
                        key={p.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-5 bg-card rounded-2xl border border-border shadow-sm flex flex-col gap-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-10 h-10 rounded-full flex items-center flex-shrink-0 justify-center text-white font-bold text-xs bg-gradient-to-tr ${isContent ? 'from-purple-500 to-pink-500' : 'from-yellow-400 to-orange-500'}`}>
                            {p.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">@{p.username}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{promoTypeLabel}</span>
                          </div>
                          <span className="text-primary font-bold ml-auto bg-primary/10 px-2 py-1 rounded-md text-sm border border-primary/20">
                            +0.2 💎
                          </span>
                        </div>

                        {/* Thumbnail View */}
                        <div 
                           onClick={() => openViewer(p)}
                           className="w-full h-40 bg-zinc-900 rounded-xl mt-2 relative overflow-hidden flex items-center justify-center cursor-pointer group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 flex flex-col items-center justify-center text-white group-hover:scale-110 transition-transform">
                               {isContent ? <Play size={28} className="ml-1" /> : <UserPlus size={24} />}
                            </div>
                            <span className="absolute bottom-4 text-white text-xs font-bold uppercase tracking-widest">
                               {isContent ? 'Assistir Conteúdo' : 'Ver Perfil'}
                            </span>
                        </div>
                      </motion.div>
                    )})
                  )}
                </AnimatePresence>
                </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <DailyRewardModal 
         open={showDailyModal} 
         onClose={() => setShowDailyModal(false)} 
      />

      <InstaViewerModal
         open={viewerOpen}
         onClose={() => {
            setViewerOpen(false);
            setActivePromo(null);
         }}
         url={activePromo?.url || ''}
         type={activePromo ? (getInstaLinkType(activePromo.url) as any) : 'post'}
         username={activePromo?.username || ''}
         onInteract={handleInteract}
         title={activePromo ? (getInstaLinkType(activePromo.url) === 'post' ? 'Divulgação de Postagem' : (getInstaLinkType(activePromo.url) === 'reel' ? 'Assistir Reel' : 'Divulgação de Perfil')) : ''}
      />
    </div>
  );
}
