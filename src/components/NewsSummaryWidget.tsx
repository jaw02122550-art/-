import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Newspaper, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// We create a new instance right before use to ensure the latest API key, 
// as per the gemini-api skill's advice for paid keys.
function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

interface NewsItem {
  title: string;
  summary: string;
  url: string;
}

export function NewsSummaryWidget() {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchNews() {
    setLoading(true);
    setError(null);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "สรุปข่าวเกษตรล่าสุดในประเทศไทย 1 ข่าวที่น่าสนใจและเป็นประโยชน์ต่อเกษตรกร พร้อมชื่อหัวข้อ สรุปเนื้อหาสำคัญสั้นๆ และลิงก์อ้างอิงไปยังเว็บไซต์ข่าวจริง",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              url: { type: Type.STRING },
            },
            required: ["title", "summary", "url"],
          }
        },
      });
      
      if (response.text) {
        const data = JSON.parse(response.text);
        setNews(data);
      } else {
        throw new Error("No response from AI");
      }
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError("ไม่สามารถโหลดข่าวได้ในขณะนี้");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-[#5A5A40]/10 space-y-4 shadow-sm relative overflow-hidden group"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#5A5A40]/5 pb-3">
        <div className="flex items-center gap-2 text-[#5A5A40]">
          <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/5 flex items-center justify-center">
            <Newspaper className="w-4 h-4" />
          </div>
          <span className="font-black text-sm uppercase tracking-wider">อัปเดตข่าวเกษตร</span>
        </div>
        <button 
          onClick={fetchNews}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-[#5A5A40] transition-colors rounded-lg hover:bg-gray-50 disabled:opacity-30"
          title="อัปเดตข่าว"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-3"
          >
            <Loader2 className="w-6 h-6 text-[#5A5A40]/30 animate-spin" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">กำลังวิเคราะห์ข่าวล่าสุด...</p>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center space-y-2"
          >
            <p className="text-sm text-gray-500 font-medium">{error}</p>
            <button 
              onClick={fetchNews}
              className="text-xs font-black text-[#5A5A40] underline underline-offset-4"
            >
              ลองใหม่อีกครั้ง
            </button>
          </motion.div>
        ) : news ? (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <h4 className="font-black text-lg leading-tight text-[#1a1a1a] group-hover:text-[#5A5A40] transition-colors">{news.title}</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{news.summary}</p>
            
            <div className="pt-2">
              <a 
                href={news.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-black text-[#5A5A40] bg-[#5A5A40]/5 px-5 py-2.5 rounded-full hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm active:scale-95"
              >
                อ่านเพิ่มเติม <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Decorative Gradient */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#5A5A40]/5 to-transparent rounded-bl-full pointer-events-none" />
    </motion.div>
  );
}
