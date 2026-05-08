import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, PlaySquare, UserPlus, Clock, Play } from 'lucide-react';
import { Button } from './ui/Button';
import { showNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { AnimatedIcon } from './AnimatedIcon';

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

const getDynamicMissionConfig = (type: string, level: number) => {
    const baseConfig = MISSION_CONFIG[type as keyof typeof MISSION_CONFIG];
    if (!baseConfig) return null;

    if (level <= 5) {
        return {
            goal: baseConfig.goals[level - 1],
            reward: baseConfig.rewards[level - 1],
            tickets: baseConfig.tickets ? baseConfig.tickets[level - 1] : 0
        };
    }

    const lastPaidLevel = 5;
    const baseGoal = baseConfig.goals[lastPaidLevel - 1];
    const baseReward = baseConfig.rewards[lastPaidLevel - 1];
    const baseTickets = baseConfig.tickets ? baseConfig.tickets[lastPaidLevel - 1] : 0;

    const diff = level - lastPaidLevel;
    const goalMultiplier = Math.pow(1.5, diff);
    const rewardMultiplier = Math.pow(1.4, diff);

    let goal = Math.floor(baseGoal * goalMultiplier);
    if (goal > 100) goal = Math.round(goal / 10) * 10;
    
    const reward = parseFloat((baseReward * rewardMultiplier).toFixed(1));
    const tickets = Math.floor(baseTickets + diff / 2);

    return { goal, reward, tickets };
};

export function MissionsTab({ onGoToFeed }: { onGoToFeed: () => void }) {
    const [state, setState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeSeconds, setTimeSeconds] = useState(0);
    const { refreshUser } = useAuth();
    
    const loadMissions = async () => {
        try {
            const res = await fetch('/api/missions');
            if (res.ok) setState(await res.json());
        } catch {
            showNotification.error('Erro ao carregar missões');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMissions();
        
        // Local sub-minute progress for time mission
        const smoothInterval = setInterval(() => {
            if (!document.hidden) {
                setTimeSeconds(prev => {
                    if (prev >= 59) return 0;
                    return prev + 1;
                });
            }
        }, 1000);

        // Refresh mission data every 30s to sync with global progress
        const interval = setInterval(loadMissions, 30000);

        return () => {
            clearInterval(interval);
            clearInterval(smoothInterval);
        };
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
                 timeSeconds={key === 'time' ? timeSeconds : 0}
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

function MissionCard({ missionKey, config, state, onUpdate, refreshUser, onOpenViewer, timeSeconds }: any) {
    const [submitting, setSubmitting] = useState(false);
    const { user } = useAuth();

    const dynamicConfig = getDynamicMissionConfig(missionKey, state.level);
    if (!dynamicConfig) return null;

    const levelIndex = Math.min(state.level - 1, 4);
    const bgGradient = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
    const goal = dynamicConfig.goal;
    let reward = dynamicConfig.reward;
    const tickets = dynamicConfig.tickets;

    if (user?.plan_type === 'pro') reward *= 1.8;
    else if (user?.plan_type === 'premium') reward *= 2.3;
    else if (user?.plan_type === 'ultra') reward *= 2.8;

    reward = parseFloat(reward.toFixed(1));

    // Smooth progress for time mission
    const displayProgress = missionKey === 'time' && state.progress < goal 
        ? state.progress + (timeSeconds / 60)
        : state.progress;

    const isCompleted = state.progress >= goal;
    const progressPercent = Math.min((displayProgress / goal) * 100, 100);

    const handleClaim = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setSubmitting(true);
        try {
            const res = await fetch('/api/missions/claim', {
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
            <div className="p-4 sm:p-5 relative overflow-hidden flex flex-col gap-4">
                <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-5`}></div>
                
                <div className="flex items-center justify-between relative z-10 w-full">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white shadow-md flex-shrink-0 bg-gradient-to-br ${bgGradient}`}>
                            <config.icon size={18} className="sm:w-[22px] sm:h-[22px]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-sm sm:text-base truncate">{config.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                                <span>Nível {state.level}</span>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="text-primary font-bold flex items-center gap-1">
                                    {reward} <AnimatedIcon type="coin" size={14} />
                                </span>
                                {tickets > 0 && (
                                  <>
                                    <span className="text-muted-foreground/30">•</span>
                                    <span className="text-orange-500 font-bold flex items-center gap-0.5">
                                      +{tickets} <AnimatedIcon type="ticket" size={14} />
                                    </span>
                                  </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden relative z-10 mt-1">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className={`h-full bg-gradient-to-r ${bgGradient}`}
                    />
                </div>

                <div className="flex items-center justify-between mt-1 gap-2">
                    <div className="text-left font-mono">
                       <span className="font-bold text-xl sm:text-2xl text-foreground">
                          {missionKey === 'time' ? displayProgress.toFixed(1) : state.progress}
                       </span>
                       <span className="text-muted-foreground text-[10px] sm:text-sm font-medium"> / {goal} {missionKey === 'time' ? 'min' : ''}</span>
                    </div>
                    
                    {isCompleted ? (
                        <Button 
                            onClick={handleClaim} 
                            isLoading={submitting}
                            size="sm"
                            className={`bg-gradient-to-r ${bgGradient} text-white shadow-lg border-none hover:opacity-90 font-bold px-4 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm`}
                        >
                            Resgatar
                        </Button>
                    ) : missionKey !== 'time' ? (
                        <Button 
                            onClick={onOpenViewer}
                            variant="secondary"
                            size="sm"
                            className="bg-secondary/80 hover:bg-secondary font-bold text-foreground group h-9 sm:h-10 text-xs sm:text-sm"
                        >
                            Ir para Missão <Play size={14} className="ml-1 sm:ml-2 group-hover:scale-110 transition-transform text-primary" />
                        </Button>
                    ) : (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-widest px-2 py-1 bg-secondary rounded-md">Automático</span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
