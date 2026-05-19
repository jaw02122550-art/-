import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Bug, 
  Zap, 
  Search, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle,
  History,
  Send,
  Loader2,
  Cpu,
  RefreshCcw,
  BookOpen
} from 'lucide-react';
import { useSystemMonitor } from '../hooks/useSystemMonitor';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function SystemHealthPage() {
  const { metrics, getDiagnostics } = useSystemMonitor() as any;
  const [problemDescription, setProblemDescription] = useState('');
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const q = query(collection(db, 'system_knowledge'), orderBy('createdAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSolve = async () => {
    if (!problemDescription.trim()) return;
    setSolving(true);
    setResult(null);

    try {
      const diagnostics = getDiagnostics();
      const recentSolutions = history.map(h => ({ problem: h.problemDescription, solution: h.solution }));

      const response = await fetch('/api/ai/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemDescription,
          diagnostics,
          recentSolutions
        })
      });

      const data = await response.json();
      setResult(data);

      // Save to knowledge base (Learning)
      if (data.confidence > 0.7) {
        await addDoc(collection(db, 'system_knowledge'), {
          problemDescription,
          analysis: data.analysis,
          solution: data.solution,
          technicalNote: data.technicalNote,
          diagnostics,
          createdAt: serverTimestamp()
        });
        loadHistory();
      }
    } catch (error) {
      console.error("Solver Error:", error);
      alert("ไม่สามารถแก้ปัญหาได้ในขณะนี้");
    } finally {
      setSolving(false);
      setProblemDescription('');
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-[#5A5A40] p-3 rounded-2xl text-white shadow-lg">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1a1a1a]">AI แก้ไขปัญหาอัจฉริยะ</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Self-Healing & Learning System</p>
          </div>
        </div>
      </header>

      {/* System Metrics Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-[#5A5A40]/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-blue-600 uppercase">สถานะ</span>
          </div>
          <div>
            <h3 className="text-2xl font-black">เสถียร</h3>
            <p className="text-xs text-gray-400">ระบบทำงานเป็นปกติ 100%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-[#5A5A40]/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-orange-600 uppercase">คอขวด</span>
          </div>
          <div>
            <h3 className="text-2xl font-black">{metrics?.filter((m: any) => m.type === 'error').length || 0}</h3>
            <p className="text-xs text-gray-400">พบจุดผิดปกติในเซสชันปัจจุบัน</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-[#5A5A40]/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-purple-600 uppercase">การเรียนรู้</span>
          </div>
          <div>
            <h3 className="text-2xl font-black">{history.length}+</h3>
            <p className="text-xs text-gray-400">ปัญหาที่เรียนรู้การแก้ไขแล้ว</p>
          </div>
        </div>
      </section>

      {/* Problem Input */}
      <section className="bg-[#5A5A40] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black">พบปัญหาอะไรในเว็บไซต์?</h2>
            <p className="text-sm opacity-80 leading-relaxed">
              อธิบายปัญหาที่เกิดขึ้น เช่น "หน้าเว็บโหลดช้า", "บัคที่หน้าโปรไฟล์" 
              เพื่อให้ AI วิเคราะห์และเรียนรู้วิธีแก้ไข
            </p>
          </div>

          <div className="space-y-4">
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="ตัวอย่าง: หน้าตลาดแสดงผลรูปภาพช้ามาก..."
              className="w-full bg-white/10 border border-white/20 rounded-3xl px-6 py-4 text-sm focus:ring-2 focus:ring-white/40 outline-none placeholder:text-white/40 min-h-[120px] resize-none"
            />
            <button
              onClick={handleSolve}
              disabled={solving || !problemDescription.trim()}
              className="w-full bg-white text-[#5A5A40] py-4 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
            >
              {solving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังแก้ไขและเรียนรู้...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-5 h-5" />
                  วิเคราะห์และแก้ไขปัญหา
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <Bug className="absolute bottom-4 right-8 w-24 h-24 text-white/5 -rotate-12" />
      </section>

      {/* Result Display */}
      <AnimatePresence>
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-100 rounded-[40px] p-8 space-y-6"
          >
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle className="w-6 h-6" />
              <h3 className="font-black text-xl">AI วิเคราะห์ผลเรียบร้อยแล้ว</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-green-600/60 uppercase tracking-widest">การวิเคราะห์ปัญหา</label>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">
                  {result.analysis}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-green-600/60 uppercase tracking-widest">แนวทางการแก้ไข</label>
                <div className="bg-white p-4 rounded-2xl border border-green-200 text-sm text-gray-700 font-bold">
                  {result.solution}
                </div>
              </div>
            </div>

            {result.technicalNote && (
              <div className="bg-black/5 p-6 rounded-3xl space-y-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <Cpu className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">บันทึกทางเทคนิค</span>
                </div>
                <code className="block text-xs font-mono text-gray-600 bg-white/50 p-4 rounded-xl border border-black/5 overflow-x-auto">
                  {result.technicalNote}
                </code>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* History / Knowledge Base */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#5A5A40]" />
            <h3 className="font-bold text-lg">คลังความรู้ที่เรียนรู้แล้ว (Knowledge Base)</h3>
          </div>
          <p className="text-[10px] font-black text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded-md">ล่าสุด {history.length} รายการ</p>
        </div>

        <div className="space-y-3">
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">ยังไม่มีประวัติการเรียนรู้</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex gap-4 items-start group hover:border-[#5A5A40]/20 transition-all">
                <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#5A5A40]/5 group-hover:text-[#5A5A40] transition-colors">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-sm text-[#1a1a1a]">{item.problemDescription}</h4>
                  <p className="text-[12px] text-gray-500 line-clamp-1">{item.solution}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest pt-1">
                    {item.createdAt?.toDate().toLocaleDateString('th-TH', { 
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <button className="p-2 text-gray-300 hover:text-[#5A5A40]">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
