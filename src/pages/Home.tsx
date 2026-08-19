import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, increment, arrayUnion, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Heart, UserPlus, RefreshCw, ShieldCheck, Gift, Target, Play, Sparkles, Filter, Film, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { MissionsTab } from '../components/MissionsTab';
import { InstaViewerModal } from '../components/InstaViewerModal';
import { InstaPreviewCard } from '../components/InstaPreviewCard';
import { MyPromotionModal } from '../components/MyPromotionModal';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { GlobalLoader } from '../components/GlobalLoader';
import { useNavigate } from 'react-router';

interface Promotion {
  id: string;
  url: string;
  user_id: string;
  username: string;
  expires_at: string;
  plan?: 'ultra' | 'premium' | 'pro' | 'basic';
  interactions_count?: number;
}

const getPlanPriority = (plan?: string) => {
  switch (plan) {
    case 'ultra': return 4;
    case 'premium': return 3;
    case 'pro': return 2;
    default: return 1;
  }
};

const getInstaLinkType = (link: string): 'reel' | 'post' | 'profile' => {
  if (!link) return 'profile';
  if (link.includes('/reel/')) return 'reel';
  return /\/(p|tv)\//i.test(link) ? 'post' : 'profile';
};

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [hasDailyRewardAvailable, setHasDailyRewardAvailable] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'missions' | 'feed'>('missions');
  const [feedFilter, setFeedFilter] = useState<'all' | 'reels' | 'posts' | 'profiles' | 'mine'>('all');
  
  // Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);

  // My Promotion Modal State
  const [myPromoModalOpen, setMyPromoModalOpen] = useState(false);
  const [selectedMyPromo, setSelectedMyPromo] = useState<Promotion | null>(null);

  useBodyScrollLock(showDailyModal || viewerOpen || myPromoModalOpen);

  const loadPromos = async () => {
    try {
      const promosSnapshot = await getDocs(collection(db, 'promotions'));
      const now = new Date().toISOString();
      const loadedPromos = promosSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Promotion))
        .filter(p => !p.expires_at || p.expires_at > now);
      
      const interacted = (user as any)?.interacted_promos || [];
      
      // Include all non-expired promotions. For user's own promos, we keep them visible!
      const availablePromos = loadedPromos.filter(p => {
        // If it's user's own promotion, always show it!
        if (user && p.user_id === user.id) return true;
        // Otherwise show if not interacted yet
        return !interacted.includes(p.id);
      });
      
      setPromotions(availablePromos);
    } catch (error) {
      console.error('Error fetching promos:', error);
      showNotification.error('Erro ao carregar feed');
    }
  };

  const checkDailyRewards = async () => {
    try {
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
  }, [user?.id]);

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
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const missionsProgress = userData?.missions_progress || {};
      const missionData = missionsProgress[missionType] || { level: 1, progress: 0 };
      
      const now = new Date();
      const lastUpdatedMs = missionData.updated_at ? new Date(missionData.updated_at).getTime() : 0;
      if (lastUpdatedMs > 0 && now.getTime() - lastUpdatedMs > 15 * 60 * 1000) {
        missionData.progress = 1;
      } else {
        missionData.progress = (missionData.progress || 0) + 1;
      }
      missionData.updated_at = now.toISOString();

      await updateDoc(userRef, {
        credits: increment(0.2),
        interacted_promos: arrayUnion(activePromo.id),
        [`missions_progress.${missionType}`]: missionData
      });

      // Award referral commission if user was invited by someone
      if (userData?.referred_by) {
        try {
          const referrerRef = doc(db, 'users', userData.referred_by);
          const referrerDoc = await getDoc(referrerRef);
          if (referrerDoc.exists()) {
            const referrerData = referrerDoc.data();
            const plan = referrerData.plan_type || 'basic';
            let rate = 0.10;
            if (plan === 'pro') rate = 0.20;
            else if (plan === 'premium') rate = 0.30;
            else if (plan === 'ultra') rate = 0.50;

            const commissionAmount = Number((0.2 * rate).toFixed(4));
            if (commissionAmount > 0) {
              await updateDoc(referrerRef, {
                credits: increment(commissionAmount)
              });

              await addDoc(collection(db, 'commissions'), {
                referrer_id: userData.referred_by,
                referred_id: user.id,
                referred_username: user.username || user.email?.split('@')[0] || 'Usuário',
                amount: commissionAmount,
                action_type: 'interaction',
                created_at: new Date().toISOString()
              });
            }
          }
        } catch (comErr) {
          console.error("Error giving referral commission:", comErr);
        }
      }

      // Increment the interaction count for the promotion
      const promoRef = doc(db, 'promotions', activePromo.id);
      await updateDoc(promoRef, {
        interactions_count: increment(1)
      });

      showNotification.success(`Parabéns! Você ganhou +0.2 moedas!`);
      setPromotions(prev => prev.filter(p => p.id !== activePromo.id));
      await refreshUser();
    } catch (error) {
      console.error('Error interacting:', error);
      showNotification.error('Erro ao processar interação');
    } finally {
      setViewerOpen(false);
      setActivePromo(null);
    }
  };

  const handleCardClick = (promo: Promotion) => {
    // If it's user's own promo, open management modal
    if (user && promo.user_id === user.id) {
      setSelectedMyPromo(promo);
      setMyPromoModalOpen(true);
      return;
    }

    setActivePromo(promo);
    setViewerOpen(true);
  };

  // Sort & Filter promotions
  const filteredPromotions = promotions.filter(p => {
    const type = getInstaLinkType(p.url);
    const isMine = user && p.user_id === user.id;

    if (feedFilter === 'mine') return isMine;
    if (feedFilter === 'reels') return type === 'reel';
    if (feedFilter === 'posts') return type === 'post';
    if (feedFilter === 'profiles') return type === 'profile';
    return true;
  }).sort((a, b) => {
    // Show user's own promos or VIP boosted promos at the top
    const aMine = (user && a.user_id === user.id) ? 10 : 0;
    const bMine = (user && b.user_id === user.id) ? 10 : 0;
    return (getPlanPriority(b.plan) + bMine) - (getPlanPriority(a.plan) + aMine);
  });

  const myPromosCount = promotions.filter(p => user && p.user_id === user.id).length;

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-xl mx-auto w-full">
      <GlobalLoader isLoading={loading} />
      
      {/* Header */}
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

      {/* Rewards & Tips Bar */}
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
                <h3 className="font-extrabold text-xs sm:text-sm text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 animate-pulse uppercase tracking-wider">Perfil Público</h3>
                <p className="text-[10px] sm:text-xs text-blue-900/90 dark:text-blue-100/90 font-medium mt-1">
                  Certifique-se de que os posts e perfis divulgados sejam <b>Públicos</b> para receber interações.
                </p>
              </div>
            </div>
         </div>
      </div>

      {/* Main Tabs (Missões / Feed Geral) */}
      <div className="bg-secondary/40 p-1 rounded-2xl flex border border-border">
        <button 
          onClick={() => setActiveTab('missions')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'missions' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Target size={18} className={activeTab === 'missions' ? 'text-primary' : ''} />
          Missões
        </button>
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'feed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Sparkles size={18} className={activeTab === 'feed' ? 'text-primary' : ''} />
          Feed Geral {promotions.length > 0 && <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{promotions.length}</span>}
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
             className="flex flex-col gap-5"
           >
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  onClick={() => setFeedFilter('all')}
                  className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    feedFilter === 'all' 
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles size={14} /> Todos ({promotions.length})
                </button>

                <button
                  onClick={() => setFeedFilter('reels')}
                  className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    feedFilter === 'reels' 
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Film size={14} /> Reels (10s)
                </button>

                <button
                  onClick={() => setFeedFilter('posts')}
                  className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    feedFilter === 'posts' 
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/20' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Heart size={14} /> Curtidas
                </button>

                <button
                  onClick={() => setFeedFilter('profiles')}
                  className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    feedFilter === 'profiles' 
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserPlus size={14} /> Seguidores
                </button>

                {myPromosCount > 0 && (
                  <button
                    onClick={() => setFeedFilter('mine')}
                    className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      feedFilter === 'mine' 
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sparkles size={14} /> Minhas ({myPromosCount})
                  </button>
                )}
              </div>

              {/* Promotions Cards Grid */}
              <div className="flex flex-col gap-5">
                <AnimatePresence>
                  {loading && promotions.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-56 bg-secondary animate-pulse rounded-3xl border border-border"></div>
                    ))
                  ) : filteredPromotions.length === 0 ? (
                    <motion.div 
                       initial={{ opacity: 0 }} 
                       animate={{ opacity: 1 }}
                       className="text-center p-8 sm:p-12 bg-card rounded-3xl border border-border flex flex-col items-center justify-center gap-4 shadow-sm"
                    >
                      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                        <Sparkles size={26} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Nenhuma divulgação encontrada neste filtro.</p>
                        <p className="text-xs text-muted-foreground mt-1">Crie sua divulgação para alcançar milhares de pessoas!</p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={loading}>
                          <RefreshCw size={14} className="mr-2" /> Recarregar
                        </Button>
                        <Button size="sm" onClick={() => navigate('/create')}>
                          <PlusCircle size={14} className="mr-2" /> Divulgar Agora
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    filteredPromotions.map((p, i) => {
                      const linkType = getInstaLinkType(p.url);
                      const isOwner = Boolean(user && p.user_id === user.id);

                      return (
                        <motion.div 
                          key={p.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <InstaPreviewCard 
                            url={p.url}
                            type={linkType}
                            username={p.username}
                            isOwner={isOwner}
                            plan={p.plan}
                            interactionsCount={p.interactions_count || 0}
                            expiresAt={p.expires_at}
                            onClick={() => handleCardClick(p)}
                          />
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <DailyRewardModal 
         open={showDailyModal} 
         onClose={() => setShowDailyModal(false)} 
      />

      {/* Viewer Modal with 10-Second Reels Watch Timer */}
      <InstaViewerModal
         open={viewerOpen}
         onClose={() => {
            setViewerOpen(false);
            setActivePromo(null);
         }}
         url={activePromo?.url || ''}
         type={activePromo ? getInstaLinkType(activePromo.url) : 'post'}
         username={activePromo?.username || ''}
         onInteract={handleInteract}
         title={activePromo ? (getInstaLinkType(activePromo.url) === 'post' ? 'Divulgação de Postagem' : (getInstaLinkType(activePromo.url) === 'reel' ? 'Assistir Reel (10 Segundos)' : 'Divulgação de Perfil')) : ''}
      />

      {/* Modal for User's Own Promotion */}
      <MyPromotionModal 
        open={myPromoModalOpen}
        onClose={() => {
          setMyPromoModalOpen(false);
          setSelectedMyPromo(null);
        }}
        promotion={selectedMyPromo}
      />
    </div>
  );
}

