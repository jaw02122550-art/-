import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Plus, 
  X, 
  AlertCircle,
  Bot,
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

const SUGGESTIONS = [
  "สูตรแก้ไอด้วยสมุนไพร",
  "วิธีปลูกฟ้าทะลายโจร",
  "โรคพืชใบเหลืองแก้ยังไง",
  "สมุนไพรบำรุงธาตุ",
  "การใช้กัญชงอย่างปลอดภัย"
];

interface Message {
  role: 'user' | 'model';
  content: string;
  image?: string;
  timestamp: Date;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: 'สวัสดีครับ ผมคือผู้ช่วยอัจฉริยะเกษตรกรไทย ยินดีให้คำปรึกษาเรื่องสมุนไพร การปลูกพืช และโรคพืชต่างๆ ครับ มีอะไรให้ผมช่วยไหมครับ?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() && !selectedImage) return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const history = messages
        .filter((m, i) => !(i === 0 && m.role === 'model'))
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text || "วิเคราะห์รูปภาพนี้ให้หน่อย",
          history,
          image: userMessage.image ? userMessage.image.split(',')[1] : null
        })
      });

      if (!response.ok) throw new Error("Failed to contact AI server");
      
      const data = await response.json();
      const aiText = data.text;

      const aiMessage: Message = {
        role: 'model',
        content: aiText || 'ขออภัยครับ ผมไม่สามารถประมวลผลคำขอได้ในขณะนี้',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        content: 'เกิดข้อผิดพลาดในการติดต่อผู้ช่วย AI โปรดลองอีกครั้งในภายหลัง',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white overflow-hidden sm:rounded-3xl sm:shadow-lg sm:border sm:border-[#5A5A40]/10 m-4 sm:m-6">
      {/* Disclaimer */}
      <div className="bg-orange-50 border-b border-orange-100 p-2 text-[10px] text-orange-800 flex items-center gap-2">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>ข้อมูลจาก AI ใช้เพื่อการอ้างอิงเบื้องต้นเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์จริง</span>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-3 max-w-[85%]",
              m.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
              m.role === 'user' ? "bg-[#5A5A40] text-white" : "bg-green-100 text-green-700"
            )}>
              {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className="space-y-2">
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                m.role === 'user' 
                  ? "bg-[#5A5A40] text-white rounded-tr-none" 
                  : "bg-gray-100 text-[#1a1a1a] rounded-tl-none shadow-sm"
              )}>
                {m.image && (
                  <img src={m.image} alt="User upload" className="rounded-lg mb-2 max-w-full h-auto border-2 border-white/20" />
                )}
                <div className="markdown-body">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium px-1">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-gray-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        {/* Suggestion Chips */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="px-4 py-2 bg-white border border-[#5A5A40]/10 rounded-full text-xs font-bold text-[#5A5A40] whitespace-nowrap hover:bg-[#5A5A40]/5 transition-colors shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Selected Image Preview */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative inline-block mb-3"
            >
              <img src={selectedImage} alt="Selected" className="w-20 h-20 object-cover rounded-xl border-2 border-white shadow-md" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className="p-3 bg-white border border-[#5A5A40]/10 rounded-2xl text-[#5A5A40] hover:bg-[#5A5A40]/5 shadow-sm active:scale-95 transition-all flex items-center gap-2 px-4"
            title="เลือกรูปภาพ"
          >
            <ImageIcon className="w-6 h-6" />
            <span className="text-xs font-bold sm:block hidden">เพิ่มรูป</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="พิมพ์คำถามหรือกดส่งรูป..."
              className="w-full bg-white border border-[#5A5A40]/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#5A5A40]/30 outline-none shadow-sm pr-10"
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={loading || (!input.trim() && !selectedImage)}
            className="p-3 bg-[#5A5A40] text-white rounded-2xl shadow-lg hover:opacity-90 disabled:opacity-30 transition-all active:scale-95"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
