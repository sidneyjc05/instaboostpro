import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, PlaySquare, UserPlus, Clock, Play } from 'lucide-react';
import { Button } from './ui/Button';
import { showNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const MISSION_CONFIG = {
  likes: {
    title: 'Curtir Posts / Imagens',
    icon: Heart,
    baseColor: 'emerald',
    goals: [10, 25, 50, 100, 200],
    rewards: [0.2, 0.5, 1.5, 3.0, 6.0],
    tickets: [0, 1, 1, 2, 3],
    actionText: 'Curtir no Instagram',
    dummyLink: 'https://www.instagram.com/p/C_q41-fM-sW/',
    type: 'post'
  },
  reels: {
    title: 'Assistir Reels / Vídeos',
    icon: PlaySquare,
    baseColor: 'emerald',
    goals: [3, 8, 15, 30, 60],
    rewards: [0.3, 1.0, 3.0, 7.0, 14.0],
    tickets: [1, 2, 3, 4, 5],
    actionText: 'Assistir Reel',
    dummyLink: 'https://www.instagram.com/reel/C-16HntO_5N/',
    type: 'reel'
  },
  follows: {
    title: 'Seguir Perfis',
    icon: UserPlus,
    baseColor: 'emerald',
    goals: [5, 15, 30, 60, 120],
    rewards: [0.3, 1.0, 2.5, 5.0, 12.0],
    tickets: [1, 1, 2, 2, 3],
    actionText: 'Seguir Perfil',
    dummyLink: 'https://www.instagram.com/instagram/',
    type: 'profile'
  },
  time: {
    title: 'Tempo no Aplicativo',
    icon: Clock,
    baseColor: 'emerald',
    goals: [1, 5, 10, 20, 40],
    rewards: [0.5, 1.5, 3.5, 7.0, 15.0],
    tickets: [0, 0, 1, 1, 2],
    actionText: '',
    dummyLink: '',
    type: 'time'
  }
};

const LEVEL_COLORS = [
  'from-emerald-500 to-green-600',
  'from-teal-500 to-cyan-600',
  'from-blue-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-purple-500 to-violet-600'
];

export function MissionsTab({ onGoToFeed }: { onGoToFeed: () => void }) {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { refreshUser } = useAuth();
  
  const loadMissions = async () => {
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'api/missions');
      if (res.ok) setState(await res.json());
    } catch {
      showNotification.error('Erro ao carregar missões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
    
    // Increment time mission every minute
    const interval = setInterval(async () => {
        if (!document.hidden) {
            try {
                await fetch(import.meta.env.BASE_URL + 'api/missions/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'time', amount: 1 })
                });
                loadMissions();
            } catch {}
        }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !state) {
    return (
      <div className="flex flex-col gap-4">
        {[1,2,3,4].map(i => (
           <div key={i} className="h-32 bg-secondary animate-pulse rounded-2xl"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
       <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
          <Clock className="text-primary mt-1 shrink-0" />
          <p className="text-sm text-foreground/90">
             Após 10 minutos de inatividade, o progresso da sua missão é zerado (exceto recompensas resgatadas). Foco total!
          </p>
       </div>

       {Object.entries(MISSION_CONFIG).map(([key, config]) => (
         <MissionCard 
            key={key} 
            missionKey={key} 
            config={config} 
            state={state[key]} 
            onUpdate={loadMissions}
            refreshUser={refreshUser}
            onOpenViewer={() => {
                if (key !== 'time') onGoToFeed();
            }}
         />
       ))}
    </div>
  );
}

function MissionCard({ missionKey, config, state, onUpdate, refreshUser, onOpenViewer }: any) {
    const [submitting, setSubmitting] = useState(false);

    const levelIndex = Math.min(state.level - 1, 4);
    const bgGradient = LEVEL_COLORS[levelIndex];
    const goal = config.goals[levelIndex];
    const reward = config.rewards[levelIndex];

    const isCompleted = state.progress >= goal;
    const progressPercent = Math.min((state.progress / goal) * 100, 100);

    const handleClaim = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setSubmitting(true);
        try {
            const res = await fetch(import.meta.env.BASE_URL + 'api/missions/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: missionKey })
            });
            const data = await res.json();
            if (res.ok) {
                showNotification.success(`Nível ${state.level} completo! Você ganhou ${data.reward} moedas.`);
                onUpdate();
                refreshUser();
            } else {
                showNotification.error(data.error);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div 
            layout
            className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col"
        >
            <div className="p-5 relative overflow-hidden flex flex-col gap-4">
                <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-5`}></div>
                
                <div className="flex items-center justify-between relative z-10 w-full">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white shadow-md`}>
                            <config.icon size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground">{config.title}</h3>
                            <p className="text-xs text-muted-foreground font-medium">
                                Nível {state.level} • Prêmio:{' '}
                                <span className="text-primary font-bold">{reward} 💎</span>
                                {config.tickets && config.tickets[state.level - 1] > 0 && (
                                  <span className="text-orange-500 font-bold ml-1">
                                    + {config.tickets[state.level - 1]} 🎟️
                                  </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden relative z-10 mt-2">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className={`h-full bg-gradient-to-r ${bgGradient}`}
                    />
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="text-left">
                       <span className="font-bold text-2xl text-foreground">{state.progress}</span>
                       <span className="text-muted-foreground text-sm font-medium"> / {goal} {missionKey === 'time' ? 'min' : ''}</span>
                    </div>
                    
                    {isCompleted ? (
                        <Button 
                            onClick={handleClaim} 
                            isLoading={submitting}
                            className={`bg-gradient-to-r ${bgGradient} text-white shadow-lg border-none hover:opacity-90 font-bold px-6`}
                        >
                            Resgatar Prêmio
                        </Button>
                    ) : missionKey !== 'time' ? (
                        <Button 
                            onClick={onOpenViewer}
                            variant="secondary"
                            className="bg-secondary/80 hover:bg-secondary font-bold text-foreground group"
                        >
                            Ir para Missão <Play size={16} className="ml-2 group-hover:scale-110 transition-transform text-primary" />
                        </Button>
                    ) : (
                        <span className="text-xs font-bold text-muted-foreground uppercase opacity-70 tracking-widest px-2 py-1 bg-secondary rounded-md">Automático</span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
