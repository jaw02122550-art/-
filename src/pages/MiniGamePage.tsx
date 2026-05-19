import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sprout, 
  Droplets, 
  Hammer, 
  Image as ImageIcon, 
  Info,
  Trophy,
  History,
  Star,
  CheckCircle2,
  Bug,
  Ghost,
  Wind,
  Leaf
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { cn } from '../lib/utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Plant {
  id: string;
  type: string;
  stage: 'seed' | 'sprout' | 'growing' | 'harvestable';
  health: number;
  plantedAt: any;
  lastWateredAt: any;
  hasPests?: boolean;
}

const PLANT_VARIETIES = [
  { name: 'ฟ้าทะลายโจร', color: 'text-green-600', harvestCoins: 50, harvestExp: 100 },
  { name: 'กะเพรา', color: 'text-green-400', harvestCoins: 30, harvestExp: 60 },
  { name: 'พริก', color: 'text-red-500', harvestCoins: 80, harvestExp: 150 },
  { name: 'ขิง', color: 'text-orange-900', harvestCoins: 120, harvestExp: 200 },
];

export default function MiniGamePage() {
  const { user, profile } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showRealSync, setShowRealSync] = useState(false);
  const [showAddPlant, setShowAddPlant] = useState(false);

  const [wateringPlantId, setWateringPlantId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchFarm = async () => {
      const farmPath = `farms/${user.uid}`;
      try {
        const farmDoc = await getDoc(doc(db, 'farms', user.uid));
        if (farmDoc.exists()) {
          setPlants(farmDoc.data().plots || []);
        } else {
          // Initial farm
          const initialPlots: Plant[] = [
            { id: '1', type: 'ฟ้าทะลายโจร', stage: 'seed', health: 100, plantedAt: new Date(), lastWateredAt: new Date() }
          ];
          await setDoc(doc(db, 'farms', user.uid), { plots: initialPlots });
          setPlants(initialPlots);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, farmPath);
      }
      setLoading(false);
    };
    fetchFarm();
  }, [user]);

  const waterPlant = async (id: string) => {
    if (!user) return;
    
    const targetPlant = plants.find(p => p.id === id);
    if (targetPlant?.hasPests) {
      alert("มีแมลงรบกวน! ต้องกำจัดแมลงก่อนรดน้ำ");
      return;
    }

    setWateringPlantId(id);
    setTimeout(() => setWateringPlantId(null), 1000);

    const updatedPlants = plants.map(p => {
      if (p.id === id) {
        const newHealth = Math.min(100, p.health + 20);
        let newStage = p.stage;
        
        // Random chance of pests appearing (10%)
        const pestChance = Math.random() < 0.1;
        
        if (newHealth >= 100) {
          if (p.stage === 'seed') newStage = 'sprout';
          else if (p.stage === 'sprout') newStage = 'growing';
          else if (p.stage === 'growing') newStage = 'harvestable';
        }

        return { 
          ...p, 
          lastWateredAt: new Date(), 
          health: newHealth, 
          stage: newStage as any,
          hasPests: pestChance ? true : (p.hasPests || false)
        };
      }
      return p;
    });

    setPlants(updatedPlants);
    const farmPath = `farms/${user.uid}`;
    try {
      await updateDoc(doc(db, 'farms', user.uid), { plots: updatedPlants });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, farmPath);
    }

    if (profile) {
      const userPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          exp: (profile.exp || 0) + 5,
          coins: (profile.coins || 0) + 1,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, userPath);
      }
    }
  };

  const treatPlant = async (id: string) => {
    if (!user || profile.coins < 5) {
      alert("คุณมีเหรียญไม่พอ (ต้องการ 5 เหรียญ)");
      return;
    }

    const updatedPlants = plants.map(p => {
      if (p.id === id) return { ...p, hasPests: false, health: Math.min(100, p.health + 10) };
      return p;
    });

    setPlants(updatedPlants);
    await updateDoc(doc(db, 'farms', user.uid), { plots: updatedPlants });
    
    if (profile) {
      await updateDoc(doc(db, 'users', user.uid), { 
        coins: (profile.coins || 0) - 5,
        updatedAt: serverTimestamp()
      });
    }
    
    alert("กำจัดการรบกวนสำเร็จ!");
  };

  const addPlant = async (type: string) => {
    if (!user) return;
    
    const newPlant: Plant = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      stage: 'seed',
      health: 80,
      plantedAt: new Date(),
      lastWateredAt: new Date(),
      hasPests: false
    };

    const updatedPlots = [...plants, newPlant];
    setPlants(updatedPlots);
    await updateDoc(doc(db, 'farms', user.uid), { plots: updatedPlots });
    setShowAddPlant(false);
  };

  const harvestPlant = async (id: string) => {
    if (!user) return;
    
    const plantToHarvest = plants.find(p => p.id === id);
    const variety = PLANT_VARIETIES.find(v => v.name === plantToHarvest?.type) || PLANT_VARIETIES[0];

    const updatedPlants = plants.filter(p => p.id !== id);

    setPlants(updatedPlants);
    await updateDoc(doc(db, 'farms', user.uid), { plots: updatedPlants });

    if (profile) {
      await updateDoc(doc(db, 'users', user.uid), {
        exp: (profile.exp || 0) + variety.harvestExp,
        coins: (profile.coins || 0) + variety.harvestCoins,
        updatedAt: serverTimestamp()
      });
    }

    alert(`เก็บเกี่ยว ${variety.name} สำเร็จ! ได้รับ ${variety.harvestCoins} เหรียญ และ ${variety.harvestExp} EXP`);
  };

  const handleAnalytic = async (file: File) => {
    if (!user) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
          "วิเคราะห์สุขภาพของพืชสมุนไพรในรูปนี้ ให้คะแนนสุขภาพ 0-100 ระบุชื่อโรคถ้ามี และให้คำแนะนำการดูแลสั้นๆ เป็นภาษาไทยในรูปแบบ JSON: { \"score\": number, \"name\": string, \"status\": string, \"advice\": string }",
          { inlineData: { mimeType: "image/jpeg", data: base64 } }
        ]);
        
        const response = result.response;
        const analysisText = response.text();
        const analysis = JSON.parse(analysisText);
        
        // Update user stats (reward for real-life activity)
        if (analysis.score && profile) {
          await updateDoc(doc(db, 'users', user.uid), {
            exp: (profile.exp || 0) + 50,
            coins: (profile.coins || 0) + 10,
            updatedAt: serverTimestamp()
          });

          alert(`วิเคราะห์เสร็จสมบูรณ์! พืชของคุณได้รับคะแนนสุขภาพ ${analysis.score}\nคำแนะนำ: ${analysis.advice}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-8 bg-gradient-to-b from-[#f5f5f0] to-[#e8e8df] min-h-screen">
      {/* Game Stats */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-[#5A5A40] flex items-center gap-2 tracking-tight">ฟาร์มอัจฉริยะ</h2>
          <div className="flex gap-4 text-xs font-bold uppercase tracking-wider text-gray-500">
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-current" /> LV. {Math.floor((profile?.exp || 0) / 100) + 1}</span>
            <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-orange-500" /> {plants.length} ต้น</span>
          </div>
        </div>
        <button 
          onClick={() => setShowRealSync(!showRealSync)}
          className="bg-white p-3 rounded-2xl shadow-sm border border-[#5A5A40]/10 text-[#5A5A40] hover:bg-white/80"
          title="วิเคราะห์พืชจริง"
        >
          <ImageIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Real World Sync Panel */}
      <AnimatePresence>
        {showRealSync && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white rounded-3xl border-2 border-dashed border-[#5A5A40]/20 p-6 flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 bg-[#5A5A40]/5 rounded-full flex items-center justify-center text-[#5A5A40]">
              <Sprout className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-lg">เชื่อมโลกจริงกับในเกม</h3>
              <p className="text-sm text-gray-500">ถ่ายรูปต้นไม้จริงของคุณเพื่อรับรางวัลและคำแนะนำลดจาก AI</p>
            </div>
            <input 
              type="file" 
              id="plant-upload" 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && handleAnalytic(e.target.files[0])}
            />
            <label 
              htmlFor="plant-upload"
              className={cn(
                "w-full py-4 bg-[#5A5A40] text-white font-bold rounded-2xl shadow-lg cursor-pointer flex items-center justify-center gap-2",
                analyzing && "opacity-50 pointer-events-none"
              )}
            >
              <ImageIcon className="w-5 h-5" />
              {analyzing ? "กำลังวิเคราะห์..." : "เลือกรูปต้นจริงเพื่อวิเคราะห์"}
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Virtual Farm Grid */}
      <div className="grid grid-cols-2 gap-4">
        {plants.map((plant) => (
          <motion.div
            key={plant.id}
            layout
            whileHover={{ scale: 1.02 }}
            className="bg-white p-5 rounded-[40px] shadow-sm border border-[#5A5A40]/10 flex flex-col items-center relative overflow-hidden"
          >
            {/* Watering Animation Overlay */}
            <AnimatePresence>
              {wateringPlantId === plant.id && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 pointer-events-none"
                >
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: -20, x: Math.random() * 100 + 40, opacity: 0 }}
                      animate={{ 
                        y: 300, 
                        opacity: [0, 1, 0],
                        transition: { duration: 0.8, delay: i * 0.1, repeat: 1 } 
                      }}
                      className="absolute top-0 text-blue-400"
                    >
                      <Droplets className="w-4 h-4 fill-current" />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
              <div className="h-12 w-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  className="w-full bg-blue-400" 
                  initial={{ height: 0 }}
                  animate={{ height: `${plant.health}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>

            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-inner relative">
              <motion.div
                animate={wateringPlantId === plant.id ? { 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0],
                } : { 
                  scale: [1, 1.05, 1], 
                  rotate: [0, 2, -2, 0] 
                }}
                transition={{ 
                  duration: wateringPlantId === plant.id ? 0.3 : 4, 
                  repeat: wateringPlantId === plant.id ? 2 : Infinity 
                }}
              >
                {plant.stage === 'seed' && <Sprout className="w-10 h-10 text-orange-600 opacity-50" />}
                {plant.stage === 'sprout' && <Leaf className={cn("w-12 h-12", plant.type === 'พริก' ? 'text-red-400' : 'text-green-400')} />}
                {plant.stage === 'growing' && <Sprout className={cn("w-16 h-16", plant.type === 'พริก' ? 'text-red-500' : 'text-green-600')} />}
                {plant.stage === 'harvestable' && (
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {plant.type === 'พริก' ? <Ghost className="w-20 h-20 text-red-600" /> : <Sprout className="w-20 h-20 text-green-800" />}
                  </motion.div>
                )}
              </motion.div>
              
              {/* Pest Indicator */}
              {plant.hasPests && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute bottom-0 right-0 bg-red-100 p-1 rounded-full border-2 border-white shadow-sm"
                >
                  <Bug className="w-4 h-4 text-red-600" />
                </motion.div>
              )}
              
              {/* Health Indicator Particles */}
              {plant.health >= 100 && plant.stage !== 'harvestable' && (
                <motion.div
                  animate={{ opacity: [0, 1, 0], y: -20 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-2 text-yellow-500"
                >
                  <Star className="w-4 h-4 fill-current" />
                </motion.div>
              )}
            </div>

            <h4 className="font-bold text-[#1a1a1a] mb-1">{plant.type}</h4>
            <p className={cn(
              "text-[10px] uppercase font-bold tracking-widest mb-4",
              plant.stage === 'harvestable' ? "text-green-600" : "text-gray-400"
            )}>
              {plant.stage === 'harvestable' ? "พร้อมเก็บเกี่ยว!" : `สถานะ: ${plant.stage}`}
            </p>

            <div className="flex gap-2 w-full mt-auto">
              {plant.hasPests ? (
                <button
                  onClick={() => treatPlant(plant.id)}
                  className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 shadow-sm transition-all active:scale-95 border border-red-200"
                >
                  <Bug className="w-5 h-5" />
                  <span>กำจัดแมลง (-5)</span>
                </button>
              ) : plant.stage === 'harvestable' ? (
                <button
                  onClick={() => harvestPlant(plant.id)}
                  className="flex-1 bg-yellow-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-yellow-500 shadow-md transition-all active:scale-95"
                >
                  <Trophy className="w-5 h-5" />
                  <span>เก็บเกี่ยว</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => waterPlant(plant.id)}
                    disabled={wateringPlantId === plant.id}
                    className="flex-1 bg-blue-50 text-blue-600 p-3 rounded-2xl flex items-center justify-center hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Droplets className="w-5 h-5" />
                  </button>
                  <button
                    className="flex-1 bg-[#5A5A40]/10 text-[#5A5A40] p-3 rounded-2xl flex items-center justify-center hover:bg-[#5A5A40]/20"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        ))}

        {/* Add Plant Button */}
        <button 
          onClick={() => setShowAddPlant(true)}
          className="bg-white/40 border-2 border-dashed border-[#5A5A40]/20 p-5 rounded-[40px] flex flex-col items-center justify-center text-[#5A5A40]/50 aspect-square hover:bg-white/60 transition-colors"
        >
          <Plus className="w-10 h-10 mb-2" />
          <span className="text-xs font-bold uppercase tracking-widest">เพิ่มแปลงปลูก</span>
        </button>
      </div>

      {/* Add Plant Modal */}
      <AnimatePresence>
        {showAddPlant && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPlant(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl space-y-6"
            >
              <h3 className="text-2xl font-black text-[#5A5A40]">เลือกพืชที่จะปลูก</h3>
              <div className="grid grid-cols-2 gap-4">
                {PLANT_VARIETIES.map((variety) => (
                  <button
                    key={variety.name}
                    onClick={() => addPlant(variety.name)}
                    className="p-5 rounded-[32px] border border-gray-100 bg-gray-50 flex flex-col items-center gap-3 hover:bg-[#5A5A40]/5 hover:border-[#5A5A40]/20 transition-all text-center"
                  >
                    <div className={cn("w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm", variety.color)}>
                      <Sprout className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{variety.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{variety.harvestCoins} ฿ • {variety.harvestExp} EXP</p>
                    </div>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowAddPlant(false)}
                className="w-full py-4 text-gray-400 font-bold uppercase tracking-widest text-xs"
              >
                ยกเลิก
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rewards/Achievements Footer */}
      <section className="bg-[#5A5A40] p-6 rounded-[32px] text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold tracking-tight text-lg">ความสำเร็จและรางวัล</h3>
          <History className="w-5 h-5 opacity-50" />
        </div>
        <div className="space-y-4">
          {[
            { id: 'start', label: 'เริ่มหน้าแรกของฟาร์ม', progress: 100, color: 'text-green-400' },
            { id: 'water', label: 'ผู้พิทักษ์น้ำ', progress: Math.min(100, Math.floor(((profile?.exp || 0) / 100) * 100)), color: 'text-blue-400' },
            { id: 'plants', label: 'นักปลูกสมุนไพรมือฉกาจ', progress: Math.min(100, Math.floor((plants.length / 6) * 100)), color: 'text-yellow-400' },
            { id: 'coins', label: 'เศรษฐีเกษตรกร', progress: Math.min(100, Math.floor(((profile?.coins || 0) / 500) * 100)), color: 'text-purple-400' },
          ].map((achievement) => (
            <div key={achievement.id} className="bg-white/10 p-4 rounded-2xl flex items-center gap-4 border border-white/5">
              <div className={cn("w-10 h-10 rounded-full bg-white/10 flex items-center justify-center", achievement.progress === 100 ? achievement.color : "text-white/30")}>
                {achievement.progress === 100 ? <CheckCircle2 className="w-6 h-6" /> : <Star className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-bold">{achievement.label}</p>
                  <p className="text-[10px] font-black opacity-50">{achievement.progress}%</p>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${achievement.progress}%` }}
                    className={cn("h-full rounded-full", achievement.progress === 100 ? "bg-green-400" : "bg-white/40")}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  );
}
