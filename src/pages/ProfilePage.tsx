import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  LogOut, 
  Award, 
  ChevronRight, 
  ShieldCheck,
  Phone,
  Globe,
  Bell,
  Camera,
  Check,
  X,
  User as UserIcon,
  MapPin,
  Edit2,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { logout, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { friendService } from '../services/friendService';
import { Users as UsersIcon } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    photoURL: ''
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  const loadFriends = async () => {
    try {
      const friendList = await friendService.getFriends(user!.uid);
      setFriends(friendList);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editForm.displayName,
        bio: editForm.bio,
        photoURL: editForm.photoURL
      });
      setIsEditing(false);
      alert("อัปเดตโปรไฟล์เรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์");
    } finally {
      setLoading(false);
    }
  };

  const resizeImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกรูปที่มีขนาดไม่เกิน 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resized = await resizeImage(base64);
        setEditForm(prev => ({ ...prev, photoURL: resized }));
      };
      reader.readAsDataURL(file);
    }
  };

  const menuItems = [
    { icon: Phone, label: 'ยืนยันเบอร์โทรศัพท์', status: 'ยังไม่ได้ยืนยัน', color: 'text-orange-500' },
    { icon: Globe, label: 'ภาษา', status: 'ไทย', color: 'text-blue-500' },
    { icon: Bell, label: 'การแจ้งเตือน', status: 'เปิดอยู่', color: 'text-green-500' },
    { icon: ShieldCheck, label: 'ความปลอดภัย', status: 'ปกติ', color: 'text-purple-500' },
  ];

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      {/* Profile Header */}
      <section className="flex flex-col items-center text-center space-y-6">
        <div className="relative group">
          <div className="w-32 h-32 rounded-full border-4 border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden bg-gray-100 flex items-center justify-center">
            {editForm.photoURL || profile?.photoURL ? (
              <img src={editForm.photoURL || profile?.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-16 h-16 text-gray-300" />
            )}
          </div>
          
          {isEditing ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-[#5A5A40] text-white p-2.5 rounded-full border-4 border-[#f5f5f0] shadow-lg active:scale-90 transition-all"
            >
              <Camera className="w-5 h-5" />
            </button>
          ) : (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 bg-[#5A5A40] text-white p-2.5 rounded-full border-4 border-[#f5f5f0] shadow-lg"
            >
              < Award className="w-5 h-5" />
            </motion.div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>
        
        <div className="w-full flex flex-col items-center gap-2">
          {isEditing ? (
            <div className="w-full space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ชื่อที่แสดง</label>
                <input 
                  value={editForm.displayName}
                  onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                  placeholder="ใส่ชื่อของคุณ..."
                  className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 text-center font-black text-lg focus:ring-2 focus:ring-[#5A5A40] outline-none shadow-sm"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">แนะนำตัว (แคปชั่น)</label>
                <textarea 
                  value={editForm.bio}
                  onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="เขียนแนะนำตัวคุณสักหน่อยว่ามาจากไหน..."
                  className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 text-sm text-gray-600 focus:ring-2 focus:ring-[#5A5A40] outline-none shadow-sm resize-none h-24"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-[2] py-4 bg-[#5A5A40] text-white font-black rounded-2xl shadow-xl shadow-[#5A5A40]/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? "กำลังบันทึก..." : <><Check className="w-4 h-4" /> บันทึกโปรไฟล์</>}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-[#1a1a1a]">{profile?.displayName}</h2>
                <button onClick={() => setIsEditing(true)} className="p-1 text-gray-300 hover:text-[#5A5A40] transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40]/60 uppercase tracking-widest">
                <span className="px-2 py-0.5 bg-[#5A5A40]/10 rounded-md text-[#5A5A40]">{profile?.role}</span>
                <span>•</span>
                <MapPin className="w-3 h-3" />
                <span>{profile?.province}</span>
              </p>
              {profile?.bio && (
                <p className="mt-2 text-sm text-gray-500 max-w-sm italic leading-relaxed">
                  "{profile.bio}"
                </p>
              )}
            </>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-2 w-full max-w-[480px]">
          {[
            { label: 'เหรียญ', value: profile?.coins || 0, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'EXP', value: profile?.exp || 0, color: 'bg-green-50 text-green-700' },
            { label: 'เพื่อน', value: friends.length, color: 'bg-purple-50 text-purple-700' },
            { label: 'เลเวล', value: Math.floor((profile?.exp || 0) / 100) + 1, color: 'bg-blue-50 text-blue-700' },
          ].map((stat) => (
            <div key={stat.label} className={cn(stat.color, "p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm border border-black/5")}>
              <span className="text-[10px] uppercase font-bold tracking-tighter opacity-70">{stat.label}</span>
              <span className="text-sm font-black">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Progress Bars */}
        <div className="w-full max-w-sm space-y-4 bg-white p-5 rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">
              <span>ความก้าวหน้าเลเวล</span>
              <span>{(profile?.exp || 0) % 100}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(profile?.exp || 0) % 100}%` }}
                className="h-full bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.3)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">
              <span>รางวัลเหรียญ (เป้าหมาย 500)</span>
              <span>{Math.min(100, Math.floor(((profile?.coins || 0) / 500) * 100))}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.floor(((profile?.coins || 0) / 500) * 100))}%` }}
                className="h-full bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.3)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg text-[#1a1a1a]">เหรียญรางวัลของคุณ</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {['ผู้เริ้มต้น', 'เพื่อนบ้านดีเยี่ยม', 'นักปลูกสมุนไพร'].map((badge, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-[#5A5A40]/10 flex flex-col items-center gap-2 min-w-[100px] shadow-sm">
              <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center">
                < Award className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-[10px] font-bold text-center leading-tight">{badge}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Friends Section */}
      {friends.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="font-bold text-lg text-[#1a1a1a]">เพื่อนของฉัน ({friends.length})</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {friends.slice(0, 8).map((friend) => (
              <div key={friend.id} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-black/5 bg-gray-50">
                  <img 
                    src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.id}`} 
                    alt={friend.displayName} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] font-bold text-[#1a1a1a] truncate w-full text-center">
                  {friend.displayName}
                </span>
              </div>
            ))}
            {friends.length > 8 && (
              <button className="flex flex-col items-center gap-1 group">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors border border-dashed border-gray-300">
                  <span className="text-xs font-black text-gray-500">+{friends.length - 8}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400">ดูทั้งหมด</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Settings List */}
      <section className="space-y-3">
        {menuItems.map((item, i) => (
          <button key={i} className="w-full bg-white p-5 rounded-3xl border border-[#5A5A40]/10 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-xl bg-gray-50", item.color)}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-sm">{item.label}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.status}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        ))}
      </section>

      {/* Logout */}
      <button 
        onClick={() => logout()}
        className="w-full py-5 bg-red-50 text-red-600 font-bold rounded-[32px] flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-6 h-6" />
        ออกจากระบบ
      </button>

      <div className="text-center pb-8">
        <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">เวอร์ชัน 1.0.0 (เบต้า)</p>
        <p className="text-[10px] text-gray-300">© 2026 เกตรกรไทย ยุคใหม่</p>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
