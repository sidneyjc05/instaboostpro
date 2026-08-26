import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, PlaySquare, UserPlus, Clock, Play, ShieldAlert, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { showNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { AnimatedIcon } from './AnimatedIcon';
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const MISSION_CONFIG = {
  likes: {
    title: 'Curtir Posts / Imagens',
    icon: Heart,
    baseColor: 'emerald',
    goals: [10, 25, 50, 100, 200],
    rewards: [0.2, 0.5, 1.5, 3.0, 6.0],
    tickets: [0, 0, 0, 0, 0],
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
    tickets: [0, 0, 0, 0, 0],
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
    tickets: [0, 0, 0, 0, 0],
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
    tickets: [0, 0, 0, 0, 0],
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

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

const getDynamicMissionConfig = (type: string, level: number) => {
    const baseConfig = MISSION_CONFIG[type as keyof typeof MISSION_CONFIG];
    if (!baseConfig) return null;

    if (level <= 5) {
        return {
            goal: baseConfig.goals[level - 1],
            reward: baseConfig.rewards[level - 1],
            tickets: 0 // Sem tickets nos níveis 1 a 5
        };
    }

    // A partir do nível 6: concessão progressiva de tickets!
    const lastPaidLevel = 5;
    const baseGoal = baseConfig.goals[lastPaidLevel - 1];
    const baseReward = baseConfig.rewards[lastPaidLevel - 1];

    const diff = level - lastPaidLevel; // Nível 6 => diff = 1
    const goalMultiplier = Math.pow(1.5, diff);
    const rewardMultiplier = Math.pow(1.4, diff);

    let goal = Math.floor(baseGoal * goalMultiplier);
    if (goal > 100) goal = Math.round(goal / 10) * 10;
    
    const reward = parseFloat((baseReward * rewardMultiplier).toFixed(1));
    // Nível 6: 1 ticket, Nível 7: 2 tickets, Nível 8: 4 tickets, etc.
    const tickets = Math.pow(2, diff - 1);

    return { goal, reward, tickets };
};

export function MissionsTab({ onGoToFeed }: { onGoToFeed: () => void }) {
    const [state, setState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { user, refreshUser } = useAuth();
    
    useEffect(() => {
        if (!user?.id || !auth.currentUser) return;
        
        const userRef = doc(db, 'users', user.id);
        const unsubscribe = onSnapshot(userRef, async (userDoc) => {
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const missionsProgress = userData?.missions_progress || {};
                const now = Date.now();
                let hasTimedOut = false;
                
                // Verificar inatividade de 15 minutos e resetar tudo para nível 1 caso tenha expirado
                for (const key of Object.keys(MISSION_CONFIG)) {
                    const m = missionsProgress[key];
                    if (m?.updated_at) {
                        const lastUpdatedMs = new Date(m.updated_at).getTime();
                        if (now - lastUpdatedMs > INACTIVITY_TIMEOUT_MS && (m.level > 1 || m.progress > 0 || m.progress_seconds > 0)) {
                            hasTimedOut = true;
                            break;
                        }
                    }
                }

                const newState: Record<string, any> = {};
                if (hasTimedOut) {
                    const resetProgress: Record<string, any> = {};
                    for (const key of Object.keys(MISSION_CONFIG)) {
                        const defaultEntry = { level: 1, progress: 0, progress_seconds: 0, updated_at: new Date().toISOString() };
                        newState[key] = defaultEntry;
                        resetProgress[key] = defaultEntry;
                    }
                    setState(newState);
                    try {
                        await updateDoc(userRef, { missions_progress: resetProgress });
                    } catch (e) {
                        console.warn('Erro ao sincronizar reset de missões:', e);
                    }
                } else {
                    for (const key of Object.keys(MISSION_CONFIG)) {
                        newState[key] = missionsProgress[key] || { level: 1, progress: 0, progress_seconds: 0, updated_at: null };
                    }
                    setState(newState);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error('Error loading missions:', error);
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [user?.id, auth.currentUser?.uid]);

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
            {/* Smart Inactivity & Level 6 Tickets Notice Card */}
            <div className="bg-gradient-to-r from-purple-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm sm:text-base">
                   <Zap size={18} className="animate-pulse" />
                   <span>Sistema de Missões, Reset por Inatividade e Tickets</span>
                </div>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                   O tempo e as ações das missões são contabilizados continuamente. Se você ficar mais de <strong>15 minutos inativo</strong>, todas as missões são <strong>reiniciadas e voltam para o Nível 1</strong>. A partir do <strong>Nível 6</strong>, todas as missões passam a conceder <strong>Tickets adicionais</strong> junto com as moedas!
                </p>
            </div>

            {Object.entries(MISSION_CONFIG).map(([key, config]) => (
              <MissionCard 
                 key={key} 
                 missionKey={key} 
                 config={config} 
                 state={state[key]} 
                 refreshUser={refreshUser}
                 onOpenViewer={() => {
                     if (key !== 'time') onGoToFeed();
                 }}
              />
            ))}
        </div>
    );
}

function MissionCard({ missionKey, config, state, refreshUser, onOpenViewer }: any) {
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

    // For time mission: calculate exact seconds
    const currentSeconds = missionKey === 'time'
        ? (state.progress_seconds !== undefined ? state.progress_seconds : Math.floor((state.progress || 0) * 60))
        : 0;

    const goalSeconds = goal * 60;

    const isCompleted = missionKey === 'time'
        ? currentSeconds >= goalSeconds
        : (state.progress || 0) >= goal;

    const progressPercent = missionKey === 'time'
        ? Math.min((currentSeconds / goalSeconds) * 100, 100)
        : Math.min(((state.progress || 0) / goal) * 100, 100);

    // Format display for time
    const timeMins = Math.floor(currentSeconds / 60);
    const timeSecs = currentSeconds % 60;
    const displayTimeText = timeMins > 0 
        ? `${timeMins}m ${timeSecs.toString().padStart(2, '0')}s`
        : `${timeSecs}s`;

    const handleClaim = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        setSubmitting(true);
        try {
            const userRef = doc(db, 'users', user.id);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            const missionsProgress = userData?.missions_progress || {};
            const mState = missionsProgress[missionKey] || { level: 1, progress: 0, progress_seconds: 0 };

            const dynConfig = getDynamicMissionConfig(missionKey, mState.level);
            if (!dynConfig) throw new Error('Configuração não encontrada');
            
            if (missionKey === 'time') {
                const sSecs = mState.progress_seconds !== undefined ? mState.progress_seconds : Math.floor((mState.progress || 0) * 60);
                if (sSecs < dynConfig.goal * 60) {
                    throw new Error('Missão de tempo ainda não concluída!');
                }
            } else {
                if ((mState.progress || 0) < dynConfig.goal) {
                    throw new Error('Missão ainda não concluída!');
                }
            }

            // Calculate actual reward
            let actualReward = dynConfig.reward;
            if (user.plan_type === 'pro') actualReward *= 1.8;
            else if (user.plan_type === 'premium') actualReward *= 2.3;
            else if (user.plan_type === 'ultra') actualReward *= 2.8;
            actualReward = parseFloat(actualReward.toFixed(1));

            const newLevel = mState.level + 1;
            
            await updateDoc(userRef, {
                credits: increment(actualReward),
                tickets: increment(dynConfig.tickets || 0),
                [`missions_progress.${missionKey}`]: {
                    level: newLevel,
                    progress: 0,
                    progress_seconds: 0,
                    updated_at: new Date().toISOString()
                }
            });

            const ticketsAwarded = dynConfig.tickets || 0;
            showNotification.success(`Nível ${mState.level} completo! Você ganhou ${actualReward} moedas${ticketsAwarded > 0 ? ` e ${ticketsAwarded} ticket(s)` : ''}!`);
            refreshUser();
        } catch (err: any) {
            showNotification.error(err.message || 'Erro ao resgatar missão');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div 
            layout
            className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-primary/40"
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

                <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden relative z-10 mt-1">
                    <div 
                        style={{ width: `${progressPercent}%` }}
                        className={`h-full bg-gradient-to-r ${bgGradient} transition-all duration-500 ease-out rounded-full`}
                    />
                </div>

                <div className="flex items-center justify-between mt-1 gap-2">
                    <div className="text-left font-mono">
                       <span className="font-bold text-xl sm:text-2xl text-foreground">
                          {missionKey === 'time' ? displayTimeText : (state.progress || 0)}
                       </span>
                       <span className="text-muted-foreground text-[10px] sm:text-sm font-medium">
                          {' '}/ {goal} {missionKey === 'time' ? 'min' : ''}
                       </span>
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
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md animate-pulse">
                           Gravando em segundo plano
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
