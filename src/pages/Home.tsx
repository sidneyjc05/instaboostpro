import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Heart, UserPlus, RefreshCw, ShieldCheck, Gift, Target, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { MissionsTab } from '../components/MissionsTab';
import { InstaViewerModal } from '../components/InstaViewerModal';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { GlobalLoader } from '../components/GlobalLoader';

interface Promotion {
  id: string;
  url: string;
  user_id: string;
  username: string;
  expires_at: string;
  plan?: 'ultra' | 'premium' | 'pro' | 'basic';
}

const getPlanConfig = (plan?: string) => {
  switch (plan) {
    case 'ultra': return { priority: 4, label: 'Ultra - Prioridade Máxima', color: 'amber', icon: ShieldCheck };
    case 'premium': return { priority: 3, label: 'Premium - Destaque', color: 'purple', icon: Gift };
    case 'pro': return { priority: 2, label: 'Pro - Vantagem', color: 'blue', icon: Target };
    default: return { priority: 1, label: 'Básico', color: 'slate', icon: null };
  }
};

// ... inside Home component, sort promotions
const getInstaLinkType = (link: string) => {
  if (!link) return 'profile';
  if (link.includes('/reel/')) return 'reel';
  return /\/(p|tv)\//i.test(link) ? 'post' : 'profile';
};

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const sortedPromotions = [...promotions].sort((a, b) => getPlanConfig(b.plan).priority - getPlanConfig(a.plan).priority);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const { user, refreshUser } = useAuth();
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [hasDailyRewardAvailable, setHasDailyRewardAvailable] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'missions' | 'feed'>('missions');
  
  // Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);

  useBodyScrollLock(showDailyModal || viewerOpen);

  const loadPromos = async () => {
    try {
      const promosSnapshot = await getDocs(collection(db, 'promotions'));
      const now = new Date().toISOString();
      const loadedPromos = promosSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Promotion))
        .filter(p => !p.expires_at || p.expires_at > now);
      
      const interacted = (user as any)?.interacted_promos || [];
      const availablePromos = loadedPromos.filter(p => !interacted.includes(p.id));
      
      setPromotions(availablePromos);
    } catch (error) {
      console.error('Error fetching promos:', error);
      showNotification.error('Erro ao carregar feed');
    }
  };

  const checkDailyRewards = async () => {
    try {
      // Determine daily reward availability based on user document
      const lastClaim = (user as any)?.last_daily_claim;
      const today = new Date().toISOString().split('T')[0];
      setHasDailyRewardAvailable(lastClaim !== today);
    } catch {}
  };

  const handleRefresh = async () => {
    setLoading(true);
    setRefreshCount(prev => prev + 1);
    try {
      await Promise.all([
        loadPromos(),
        checkDailyRewards(),
        refreshUser()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const handleInteract = async () => {
    if (!activePromo || !user) return;
    try {
      if (user.id === activePromo.user_id) {
         showNotification.error('Você não pode interagir com a própria divulgação!');
         return;
      }

      // Determine mission type
      let missionType = 'follows';
      if (activePromo.url.includes('/reel/')) {
        missionType = 'reels';
      } else if (activePromo.url.includes('/p/') || activePromo.url.includes('/tv/')) {
        missionType = 'likes';
      }

      const userRef = doc(db, 'users', user.id);
      
      // We will store missions progress inside the user document 
      // under a map: missions_progress: { 'likes': { level: 1, progress: 5, updated_at: ... }, 'follows': ... }
      // To simplify, we can just fetch the user doc first to check and update the map correctly,
      // but an easier way for a basic implementation is to do it transactionally or just read it first.
      
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const missionsProgress = userData?.missions_progress || {};
      const missionData = missionsProgress[missionType] || { level: 1, progress: 0 };
      
      // Reset progress if it hasn't been updated in 10 minutes
      const now = new Date();
      if (missionData.updated_at) {
        const lastUpdate = new Date(missionData.updated_at);
        if (now.getTime() - lastUpdate.getTime() > 10 * 60 * 1000) {
          missionData.progress = 0;
        }
      }
      
      missionData.progress += 1;
      missionData.updated_at = now.toISOString();

      await updateDoc(userRef, {
        credits: increment(0.2),
        interacted_promos: arrayUnion(activePromo.id),
        [`missions_progress.${missionType}`]: missionData
      });

      // Increment the interaction count for the promotion
      const promoRef = doc(db, 'promotions', activePromo.id);
      await updateDoc(promoRef, {
        interactions_count: increment(1)
      });

      showNotification.success(`Você ganhou 0.2 moedas!`);
      setPromotions(prev => prev.filter(p => p.id !== activePromo.id));
      refreshUser();
    } catch (error) {
      console.error('Error interacting:', error);
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
      <GlobalLoader isLoading={loading} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">InstaBoost <span className="text-primary">PRO</span></h1>
          <p className="text-muted-foreground mt-1 text-sm">Ganhe créditos interagindo com a comunidade</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2 shadow-sm">
             <AnimatedIcon type="coin" size={18} /> {(user?.credits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Moedas
          </div>
          <button onClick={handleRefresh} className="p-2 bg-secondary rounded-full hover:bg-muted text-muted-foreground hover:text-foreground relative group">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <button 
           onClick={() => setShowDailyModal(true)}
           className={`relative overflow-hidden w-full text-left rounded-2xl p-4 sm:p-5 border flex items-center justify-between transition-all shadow-sm ${hasDailyRewardAvailable ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/40 hover:from-yellow-500/30 hover:to-orange-500/30' : 'bg-secondary/50 border-border hover:bg-secondary'}`}
         >
            <div className="flex items-center gap-4 relative z-10">
               <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${hasDailyRewardAvailable ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg' : 'bg-card text-muted-foreground border'}`}>
                  <Gift size={20} className="sm:w-6 sm:h-6" />
               </div>
               <div>
                  <h3 className={`font-bold text-sm sm:text-base ${hasDailyRewardAvailable ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>Prêmio Diário</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                     {hasDailyRewardAvailable ? <><Gift size={14} className="text-amber-500" /> Resgate agora!</> : 'Calendário semanal'}
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
                <h3 className="font-extrabold text-xs sm:text-sm text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 animate-pulse uppercase tracking-wider">Termos e Dicas</h3>
                <p className="text-[10px] sm:text-xs text-blue-900/90 dark:text-blue-100/90 font-medium mt-1">
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
                       className="text-center p-6 sm:p-12 bg-secondary/50 rounded-3xl border border-border flex flex-col items-center justify-center gap-4"
                    >
                      <div>
                        <p className="text-muted-foreground">Nenhuma divulgação nova no momento.</p>
                        <p className="text-xs mt-2 opacity-60">Volte mais tarde ou crie a sua!</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={loading}>
                        <RefreshCw size={14} className="mr-2" /> Recarregar Página
                      </Button>
                    </motion.div>
                  ) : (
                    sortedPromotions.map((p, i) => {
                      const linkType = getInstaLinkType(p.url);
                      const isContent = linkType === 'post' || linkType === 'reel';
                      const promoTypeLabel = linkType === 'post' ? 'Divulgação de Postagem' : (linkType === 'reel' ? 'Divulgação de Reel' : 'Divulgação de Perfil');
                      const config = getPlanConfig(p.plan);
                      const isPromoted = p.plan && p.plan !== 'basic';
                      
                      const BGS = {
                        amber: 'bg-amber-500/10',
                        purple: 'bg-purple-500/10',
                        blue: 'bg-blue-500/10',
                        slate: 'bg-slate-500/10'
                      };
                      const BORDERS = {
                        amber: 'border-amber-500/30',
                        purple: 'border-purple-500/30',
                        blue: 'border-blue-500/30',
                        slate: 'border-border'
                      };
                      const TEXTS = {
                        amber: 'text-amber-500',
                        purple: 'text-purple-500',
                        blue: 'text-blue-500',
                        slate: ''
                      };
                      const AVATARS = {
                        amber: 'bg-gradient-to-tr from-amber-400 to-orange-500',
                        purple: 'bg-gradient-to-tr from-purple-400 to-pink-500',
                        blue: 'bg-gradient-to-tr from-blue-400 to-indigo-500',
                        slate: isContent ? 'bg-gradient-to-tr from-purple-500 to-pink-500' : 'bg-gradient-to-tr from-yellow-400 to-orange-500'
                      };
                      const BADGES = {
                        amber: 'bg-amber-500/20 text-amber-600',
                        purple: 'bg-purple-500/20 text-purple-600',
                        blue: 'bg-blue-500/20 text-blue-600',
                        slate: 'bg-primary/10 text-primary'
                      };
                      const GRADIENTS = {
                        amber: 'bg-gradient-to-tr from-amber-500/10 to-transparent',
                        purple: 'bg-gradient-to-tr from-purple-500/10 to-transparent',
                        blue: 'bg-gradient-to-tr from-blue-500/10 to-transparent',
                        slate: 'bg-card'
                      };

                      const bgColor = isPromoted ? GRADIENTS[config.color as keyof typeof GRADIENTS] : 'bg-card';
                      const borderColor = BORDERS[config.color as keyof typeof BORDERS];
                      const textColor = TEXTS[config.color as keyof typeof TEXTS];
                      const iconBg = BGS[config.color as keyof typeof BGS];
                      const avatarBg = AVATARS[config.color as keyof typeof AVATARS];
                      const badgeClasses = BADGES[config.color as keyof typeof BADGES];

                      return (
                      <motion.div 
                        key={p.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-5 rounded-3xl border ${bgColor} ${borderColor} shadow-lg flex flex-col gap-4 overflow-hidden relative`}
                      >
                        {isPromoted && (
                           <div className={`text-[10px] font-bold ${textColor} uppercase flex items-center gap-1 mb-1 ${iconBg} px-2 py-0.5 rounded-full self-start`}>
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                              >
                                {config.icon && <config.icon size={12} />}
                              </motion.div>
                              {config.label}
                           </div>
                        )}
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-12 h-12 rounded-full flex items-center flex-shrink-0 justify-center text-white font-bold text-sm ${avatarBg}`}>
                            {p.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">@{p.username}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{promoTypeLabel}</span>
                          </div>
                          <motion.span 
                             whileHover={{ scale: 1.05 }}
                             className={`${badgeClasses} font-bold ml-auto px-3 py-1 rounded-full text-xs flex items-center gap-1 border border-current`}
                          >
                            +0.2 <AnimatedIcon type="coin" size={14} className="ml-1" />
                          </motion.span>
                        </div>

                        {/* Thumbnail View */}
                        <div 
                           onClick={() => openViewer(p)}
                           className="w-full h-40 bg-zinc-900 rounded-2xl mt-2 relative overflow-hidden flex items-center justify-center cursor-pointer group shadow-inner"
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                               {isContent ? <Play size={28} className="ml-1" /> : <UserPlus size={24} />}
                            </div>
                            <span className="absolute bottom-4 text-white text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
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
