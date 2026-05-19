import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, MessageCircle, ShoppingBag, Info } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  userId: string;
  type: 'comment' | 'like' | 'order' | 'system';
  title: string;
  message: string;
  read: boolean;
  relatedId?: string;
  createdAt: any;
}

export default function NotificationManager({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));

      // If we have a notification that wasn't in our previous list, show toast
      if (newNotifications.length > 0) {
        const latest = newNotifications[0];
        // Only show toast if it's very recent (to avoid showing old unread ones on login)
        const now = new Date().getTime();
        const created = latest.createdAt?.toMillis?.() || now;
        
        // If we don't have notifications yet, or the new one is different ID from top of previous
        if (notifications.length === 0 || notifications[0].id !== latest.id) {
          if (now - created < 15000) { 
            setActiveToast(latest);
            // Auto hide after 6 seconds
            const timer = setTimeout(() => setActiveToast(null), 6000);
            return () => clearTimeout(timer);
          }
        }
      }

      setNotifications(newNotifications);
    }, (error) => {
      console.error("Notification listener error:", error);
    });

    return () => unsubscribe();
  }, [userId, notifications]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      if (activeToast?.id === id) setActiveToast(null);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleToastClick = (notif: Notification) => {
    markAsRead(notif.id);
    // Here we could emit an event or call a callback to change page
    // For simplicity in this demo, we'll just log or could use window.dispatchEvent
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: notif.type === 'comment' ? 'community' : 'home' }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'order': return <ShoppingBag className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-[#5A5A40]" />;
    }
  };

  return (
    <>
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[100] w-[90%] max-w-sm cursor-pointer"
            onClick={() => handleToastClick(activeToast)}
          >
            <div className="bg-white/95 backdrop-blur-md border-2 border-[#5A5A40]/10 rounded-[24px] p-4 shadow-2xl flex items-start gap-3 hover:border-[#5A5A40]/30 transition-all active:scale-95">
              <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/5 flex items-center justify-center shrink-0">
                {getIcon(activeToast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] mb-0.5">{activeToast.title}</h4>
                <p className="text-sm text-gray-800 leading-snug font-medium line-clamp-2">{activeToast.message}</p>
              </div>
              <button 
                onClick={(e) => markAsRead(activeToast.id, e)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
