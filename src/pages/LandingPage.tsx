import { motion } from 'motion/react';
import { Leaf, LogIn } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="bg-white p-8 rounded-full shadow-xl mb-6 inline-block border-4 border-[#5A5A40]/10">
          <Leaf className="w-24 h-24 text-[#5A5A40]" />
        </div>
        <h1 className="text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">เกตรกรไทย</h1>
        <p className="text-[#5A5A40] font-medium text-lg">แพลตฟอร์มอัจฉริยะเพื่อเกษตรกรไทยยุคใหม่</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="w-full max-w-sm space-y-4"
      >
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 bg-white text-[#1a1a1a] font-bold py-5 px-6 rounded-3xl shadow-xl border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 group"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <span className="block text-sm">เข้าสู่ระบบด้วย Google</span>
            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">เริ่มต้นใช้งานทันที</span>
          </div>
        </button>
      </motion.div>

      <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-sm">
        <div className="bg-white/50 p-4 rounded-xl text-left border border-[#5A5A40]/10">
          <h3 className="font-bold text-[#5A5A40] text-sm mb-1 uppercase tracking-wider">AI ช่วยปลูก</h3>
          <p className="text-xs text-gray-600">ปรึกษาปัญหาพืชและสมุนไพรไทยได้ 24 ชม.</p>
        </div>
        <div className="bg-white/50 p-4 rounded-xl text-left border border-[#5A5A40]/10">
          <h3 className="font-bold text-[#5A5A40] text-sm mb-1 uppercase tracking-wider">ตลาดเกษตร</h3>
          <p className="text-xs text-gray-600">ซื้อขายสินค้าส่งตรงจากฟาร์มถึงมือคุณ</p>
        </div>
      </div>
    </div>
  );
}
