import { motion } from 'motion/react';
import { 
  Sprout, 
  CloudSun, 
  TrendingUp, 
  Users, 
  ShoppingBasket,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NewsSummaryWidget } from '../components/NewsSummaryWidget';

export default function HomePage() {
  const { profile } = useAuth();

  const stats = [
    { label: 'เหรียญ', value: profile?.coins || 0, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'EXP', value: profile?.exp || 0, color: 'bg-green-100 text-green-700' },
    { label: 'ความน่าเชื่อถือ', value: `${profile?.reliabilityScore || 0}%`, color: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Section */}
      <section>
        <h2 className="text-3xl font-bold text-[#1a1a1a] mb-1">สวัสดี, {profile?.displayName?.split(' ')[0]}!</h2>
        <p className="text-[#5A5A40] font-medium uppercase tracking-widest text-xs">เกษตรกรผู้เชี่ยวชาญแดน {profile?.province || 'ไทย'}</p>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={stat.color + " p-3 rounded-2xl flex flex-col items-center justify-center text-center"}>
            <span className="text-[10px] uppercase font-bold tracking-tighter opacity-70">{stat.label}</span>
            <span className="text-lg font-black">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Weather/Daily Tips Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#5A5A40]/10 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#5A5A40]">
            <CloudSun className="w-5 h-5" />
            <span className="font-bold text-sm">สภาพอากาศวันนี้</span>
          </div>
          <p className="text-2xl font-bold">32°C มีเมฆมาก</p>
          <p className="text-xs text-gray-500">เหมาะสำหรับการใส่ปุ๋ยบำรุงดิน</p>
        </div>
        <div className="w-16 h-16 bg-[#5A5A40]/5 rounded-full flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-[#5A5A40]" />
        </div>
      </div>

      {/* AI News Summary Widget */}
      <NewsSummaryWidget />

      {/* Quick Actions Grid */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg text-[#1a1a1a] flex items-center gap-2">
          <Sprout className="w-5 h-5 text-[#5A5A40]" />
          ภารกิจวันนี้
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'game' }))}
            className="bg-white p-5 rounded-3xl border border-[#5A5A40]/10 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shrink-0 group-hover:scale-110 transition-transform">
              <Sprout className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">รดน้ำพืชในฟาร์ม</h4>
              <p className="text-xs text-gray-500">พืชของคุณต้องการน้ำเพิ่มแล้ว</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#5A5A40] group-hover:translate-x-1 transition-all" />
          </div>

          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'market' }))}
            className="bg-white p-5 rounded-3xl border border-[#5A5A40]/10 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
              <ShoppingBasket className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">ตรวจสอบตลาดสมุนไพร</h4>
              <p className="text-xs text-gray-500">ราคาขิงสดเพิ่มขึ้น 10% วันนี้</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#5A5A40] group-hover:translate-x-1 transition-all" />
          </div>

          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'community' }))}
            className="bg-white p-5 rounded-3xl border border-[#5A5A40]/10 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">ทักทายคนในชุมชน</h4>
              <p className="text-xs text-gray-500">มี 5 กระทู้ใหม่ที่คุณมีความสนใจ</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#5A5A40] group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </section>
    </div>
  );
}
