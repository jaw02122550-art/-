import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Calendar, 
  Tag, 
  ChevronRight,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface Entry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: any;
}

const CATEGORIES = {
  income: ['ขายผลผลิต', 'ขายปุ๋ย/ยา', 'ค่าเช่าที่', 'ขายสัตว์เลี้ยง', 'อื่นๆ'],
  expense: ['เมล็ดพันธุ์', 'ปุ๋ย/ยา', 'ค่าแรง', 'ค่าเครื่องจักร', 'ค่าขนส่ง', 'อื่นๆ']
};

export default function AccountingPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [newEntry, setNewEntry] = useState({
    type: 'income' as 'income' | 'expense',
    category: CATEGORIES.income[0],
    amount: '',
    description: ''
  });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'accounting'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry));
      setEntries(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddEntry = async () => {
    if (!newEntry.amount || !user) return;
    
    try {
      await addDoc(collection(db, 'accounting'), {
        userId: user.uid,
        type: newEntry.type,
        category: newEntry.category,
        amount: Number(newEntry.amount),
        description: newEntry.description,
        date: serverTimestamp()
      });
      
      setIsAdding(false);
      setNewEntry({
        type: 'income',
        category: CATEGORIES.income[0],
        amount: '',
        description: ''
      });
    } catch (error) {
      console.error("Error adding entry:", error);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !editingEntry.amount || !user) return;
    
    try {
      await updateDoc(doc(db, 'accounting', editingEntry.id), {
        type: editingEntry.type,
        category: editingEntry.category,
        amount: Number(editingEntry.amount),
        description: editingEntry.description,
        updatedAt: serverTimestamp()
      });
      
      setEditingEntry(null);
    } catch (error) {
      console.error("Error updating entry:", error);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
    try {
      await deleteDoc(doc(db, 'accounting', id));
      setEditingEntry(null);
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  };

  const totals = entries.reduce((acc, entry) => {
    if (entry.type === 'income') acc.income += entry.amount;
    else acc.expense += entry.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const filteredEntries = entries.filter(e => filter === 'all' || e.type === filter);

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Header */}
      <section className="pt-2 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#1a1a1a]">บันทึกรายรับ-รายจ่าย</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">สมุดบัญชีเกษตรกร</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="p-3 bg-[#5A5A40] text-white rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-[24px] border border-green-100 shadow-sm"
        >
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">รายรับรวม</span>
          </div>
          <p className="text-xl font-black text-green-700">฿{totals.income.toLocaleString()}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-[24px] border border-red-100 shadow-sm"
        >
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <ArrowDownRight className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">รายจ่ายรวม</span>
          </div>
          <p className="text-xl font-black text-red-700">฿{totals.expense.toLocaleString()}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="col-span-2 bg-[#5A5A40] p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">ยอดเงินคงเหลือ</p>
            <h3 className="text-4xl font-black italic">฿{(totals.income - totals.expense).toLocaleString()}</h3>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 blur-sm">
            <DollarSign className="w-40 h-40" />
          </div>
        </motion.div>
      </section>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
        {(['all', 'income', 'expense'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              filter === t ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
            )}
          >
            {t === 'all' ? 'ทั้งหมด' : t === 'income' ? 'รายรับ' : 'รายจ่าย'}
          </button>
        ))}
      </div>

      {/* Entry List */}
      <div className="space-y-3">
        {filteredEntries.map((entry, idx) => (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={entry.id}
            onClick={() => setEditingEntry(entry)}
            className="group bg-white p-4 rounded-[24px] border border-gray-50 hover:border-[#5A5A40]/20 transition-all flex items-center gap-4 cursor-pointer"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              entry.type === 'income' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            )}>
              {entry.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h4 className="font-bold text-sm text-[#1a1a1a] truncate">{entry.category}</h4>
                <p className={cn(
                  "font-black text-sm",
                  entry.type === 'income' ? "text-green-600" : "text-red-600"
                )}>
                  {entry.type === 'income' ? '+' : '-'} ฿{entry.amount.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-gray-400 line-clamp-1">{entry.description || 'ไม่มีคำอธิบาย'}</p>
                <div className="flex items-center gap-1 text-[10px] text-gray-300 font-bold whitespace-nowrap">
                  <Calendar className="w-3 h-3" />
                  <span>{entry.date?.toDate ? format(entry.date.toDate(), 'd MMM', { locale: th }) : 'กำลังโหลด...'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredEntries.length === 0 && (
          <div className="text-center py-12 opacity-20">
            <PieChart className="w-16 h-16 mx-auto mb-4" />
            <p className="text-sm font-bold">ไม่พบข้อมูลการบันทึก</p>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {(isAdding || editingEntry) && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingEntry(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#1a1a1a]">
                    {editingEntry ? 'แก้ไขรายการ' : 'บันทึกใหม่'}
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    {editingEntry ? 'แก้ไขรายละเอียดธุรกรรม' : 'เพิ่มข้อมูลรายละเอียดธุรกรรม'}
                  </p>
                </div>
                <button onClick={() => {
                  setIsAdding(false);
                  setEditingEntry(null);
                }} className="p-2 text-gray-300 hover:text-red-500">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                  {(['income', 'expense'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        if (editingEntry) {
                          setEditingEntry({ ...editingEntry, type: t, category: CATEGORIES[t][0] });
                        } else {
                          setNewEntry({ ...newEntry, type: t, category: CATEGORIES[t][0] });
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                        (editingEntry ? editingEntry.type : newEntry.type) === t ? "bg-white text-[#5A5A40] shadow-md" : "text-gray-400"
                      )}
                    >
                      {t === 'income' ? 'รายรับ' : 'รายจ่าย'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">หมวดหมู่</label>
                    <select
                      value={editingEntry ? editingEntry.category : newEntry.category}
                      onChange={e => {
                        if (editingEntry) setEditingEntry({ ...editingEntry, category: e.target.value });
                        else setNewEntry({ ...newEntry, category: e.target.value });
                      }}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-[#5A5A40] outline-none"
                    >
                      {CATEGORIES[editingEntry ? editingEntry.type : newEntry.type].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">จำนวนเงิน</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#5A5A40]">฿</span>
                      <input
                        type="number"
                        value={editingEntry ? editingEntry.amount : newEntry.amount}
                        onChange={e => {
                          if (editingEntry) setEditingEntry({ ...editingEntry, amount: Number(e.target.value) });
                          else setNewEntry({ ...newEntry, amount: e.target.value });
                        }}
                        placeholder="0.00"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-8 pr-4 py-4 text-sm font-black focus:ring-2 focus:ring-[#5A5A40] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">รายละเอียด</label>
                  <textarea
                    value={editingEntry ? editingEntry.description : newEntry.description}
                    onChange={e => {
                      if (editingEntry) setEditingEntry({ ...editingEntry, description: e.target.value });
                      else setNewEntry({ ...newEntry, description: e.target.value });
                    }}
                    placeholder="ระบุรายละเอียดเพิ่มเติม..."
                    className="w-full h-24 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {editingEntry && (
                  <button
                    onClick={() => handleDeleteEntry(editingEntry.id)}
                    className="flex-1 py-5 text-red-600 font-black rounded-2xl border border-red-100 hover:bg-red-50 transition-all text-sm uppercase tracking-widest"
                  >
                    ลบรายการ
                  </button>
                )}
                <button
                  onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
                  className={cn(
                    "flex-[2] py-5 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2",
                    (editingEntry ? editingEntry.type : newEntry.type) === 'income' ? "bg-green-600 shadow-green-200" : "bg-red-600 shadow-red-200"
                  )}
                >
                  <Plus className={cn("w-6 h-6", editingEntry && "hidden")} />
                  <span>{editingEntry ? 'อัปเดตข้อมูล' : 'ยืนยันการบันทึก'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
