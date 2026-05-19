import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  X, 
  UserCheck, 
  Clock,
  Loader2,
  Users
} from 'lucide-react';
import { friendService, Friendship } from '../services/friendService';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function FriendRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const pendingRes = await friendService.getPendingRequests(user.uid);
      
      // Fetch user data for each requester
      const requestsWithUsers = await Promise.all(pendingRes.map(async (req) => {
        const userDoc = await getDoc(doc(db, 'users', req.requesterId));
        return {
          ...req,
          user: { id: userDoc.id, ...userDoc.data() }
        };
      }));
      
      setRequests(requestsWithUsers);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request: any) => {
    if (!user) return;
    try {
      await friendService.acceptFriendRequest(request.id, user.uid);
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error("Error accepting request:", error);
      alert("ไม่สามารถยอมรับคำขอได้");
    }
  };

  const handleDecline = async (request: any) => {
    try {
      await friendService.removeFriendship(request.id);
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error("Error declining request:", error);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <section className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="bg-[#5A5A40] p-2 rounded-xl text-white">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-[#5A5A40]">คำขอเป็นเพื่อน</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">รอยืนยัน {requests.length} รายการ</p>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-black/5 bg-gray-50">
              <img 
                src={req.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user?.id}`} 
                alt={req.user?.displayName} 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{req.user?.displayName}</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{req.user?.role || 'เกษตรกร'}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleAccept(req)}
                className="p-2.5 bg-[#5A5A40] text-white rounded-xl shadow-lg shadow-[#5A5A40]/20 active:scale-95 transition-all"
                title="ยอมรับ"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDecline(req)}
                className="p-2.5 bg-white border border-gray-200 text-gray-400 rounded-xl hover:bg-gray-50 transition-all"
                title="ปฏิเสธ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
