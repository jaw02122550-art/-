import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  UserCheck, 
  X, 
  MapPin, 
  Award,
  ChevronRight,
  Loader2,
  Clock
} from 'lucide-react';
import { friendService } from '../services/friendService';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

export default function UserDiscovery() {
  const { user } = useAuth();
  const [recommendedUsers, setRecommendedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const users = await friendService.getRecommendedUsers(user.uid);
      setRecommendedUsers(users);
    } catch (error) {
      console.error("Error loading recommended users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!user) return;
    
    // OPTIMISTIC UPDATE: Update UI immediately
    setPendingRequests(prev => ({ ...prev, [targetUserId]: true }));
    
    try {
      await friendService.sendFriendRequest(user.uid, targetUserId);
    } catch (error) {
      console.error("Error sending friend request:", error);
      // Rollback on error
      setPendingRequests(prev => ({ ...prev, [targetUserId]: false }));
      alert("ไม่สามารถส่งคำขอได้ในขณะนี้");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-end px-2">
          <div className="h-8 w-32 bg-gray-100 animate-pulse rounded-lg" />
          <div className="h-4 w-16 bg-gray-100 animate-pulse rounded-lg" />
        </div>
        <div className="flex gap-4 overflow-hidden px-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-44 h-64 bg-gray-50 animate-pulse rounded-[32px] border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendedUsers.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-end px-2">
        <div>
          <h3 className="text-lg font-black text-[#5A5A40]">เพื่อนใหม่ที่คุณอาจรู้จัก</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">แนะนำสำหรับคุณ</p>
        </div>
        <button className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] hover:underline flex items-center gap-1">
          ดูทั้งหมด <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-2">
        {recommendedUsers.map((u) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 w-44 bg-white rounded-3xl border border-[#5A5A40]/10 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center space-y-3 relative group"
          >
            <div className="w-20 h-20 rounded-full border-2 border-[#5A5A40]/10 overflow-hidden bg-gray-50 shrink-0">
              <img 
                src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} 
                alt={u.displayName} 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-sm text-[#1a1a1a] truncate w-full">{u.displayName}</h4>
              <p className="text-[10px] text-gray-400 font-bold truncate flex items-center justify-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {u.province || 'ไม่ระบุจังหวัด'}
              </p>
            </div>

            <p className="text-[9px] font-black text-[#5A5A40] bg-[#5A5A40]/5 px-2 py-0.5 rounded-full uppercase tracking-widest">
              {u.role || 'สมาชิก'}
            </p>

            <button
              disabled={pendingRequests[u.id]}
              onClick={() => handleSendRequest(u.id)}
              className={cn(
                "w-full py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5",
                pendingRequests[u.id] 
                  ? "bg-gray-100 text-gray-400 cursor-default" 
                  : "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20 active:scale-95 hover:bg-[#4A4A30]"
              )}
            >
              {pendingRequests[u.id] ? (
                <>
                  <Clock className="w-3 h-3" />
                  รอการตอบรับ
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  เพิ่มเป็นเพื่อน
                </>
              )}
            </button>

            <button 
              className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setRecommendedUsers(prev => prev.filter(user => user.id !== u.id))}
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
