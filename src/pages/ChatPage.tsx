import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronLeft, 
  Send, 
  Phone,
  Video,
  MoreVertical,
  Plus,
  MessageCircle as MessageIcon
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { socket } from '../lib/socket';
import { useAuth } from '../hooks/useAuth';
import { ChatPreview, MOCK_CHATS } from '../constants/chats';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState<ChatPreview | null>(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'private' | 'groups'>('all');

  useEffect(() => {
    if (!selectedChat) {
      setChatMessages([]);
      return;
    }
    
    // Connect socket
    socket.connect();
    socket.emit('join-room', selectedChat.id);

    // Fetch from Firestore for history and real-time updates
    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      });
      setChatMessages(messages);
    });

    const handleNewMessage = (data: any) => {
      // Logic for new socket message if needed, 
      // but Firestore onSnapshot handles room messages well.
      // We keep socket for other types of updates or signaling.
    };

    socket.on('new-message', handleNewMessage);

    return () => {
      unsubscribe();
      socket.off('new-message', handleNewMessage);
      socket.disconnect();
    };
  }, [selectedChat]);

  const handleSend = async () => {
    if (!message.trim() || !selectedChat || !user) return;
    
    const messageData = {
      text: message,
      senderId: user.uid,
      senderName: user.displayName || 'เกษตรกรไทย',
      createdAt: serverTimestamp()
    };

    try {
      // Save to Firestore
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), messageData);
      
      // Also emit via socket for immediate notification
      socket.emit('send-message', {
        ...messageData,
        roomId: selectedChat.id,
        createdAt: new Date().toISOString()
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredChats = MOCK_CHATS.filter(chat => {
    if (activeTab === 'private') return !chat.isGroup;
    if (activeTab === 'groups') return chat.isGroup;
    return true;
  });

  const virtuosoRef = useRef<any>(null);

  if (selectedChat) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] bg-white z-[60] absolute inset-0">
        <header className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedChat(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft /></button>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
              <img src={selectedChat.avatar} alt={selectedChat.name} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight truncate max-w-[150px]">{selectedChat.name}</h3>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
                {selectedChat.isGroup ? 'แชทกลุ่ม' : 'ออนไลน์'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-full"><Phone className="w-5 h-5" /></button>
            <button className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-full"><Video className="w-5 h-5" /></button>
            <button className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-full"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 bg-[#f8f9f5]">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-30">
              <MessageIcon className="w-12 h-12 mb-2" />
              <p className="text-sm font-bold">ยังไม่มีข้อความ เริ่มคุยกันเลย!</p>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              data={chatMessages}
              initialTopMostItemIndex={chatMessages.length - 1}
              followOutput="smooth"
              className="scrollbar-hide"
              itemContent={(_, msg) => (
                <div className="px-4 py-2">
                  <div 
                    className={cn(
                      "max-w-[85%] space-y-1",
                      msg.senderId === user?.uid ? "ml-auto" : "mr-auto"
                    )}
                  >
                    {selectedChat?.isGroup && msg.senderId !== user?.uid && (
                      <p className="text-[10px] font-bold text-gray-400 ml-2">{msg.senderName}</p>
                    )}
                    <div 
                      className={cn(
                        "p-3 rounded-2xl text-sm shadow-sm",
                        msg.senderId === user?.uid 
                          ? "bg-[#5A5A40] text-white rounded-tr-none" 
                          : "bg-white text-gray-800 rounded-tl-none"
                      )}
                    >
                      {msg.text}
                      {msg.sharedPost && (
                        <div className={cn(
                          "mt-2 p-2 rounded-xl border overflow-hidden",
                          msg.senderId === user?.uid 
                            ? "bg-white/10 border-white/20" 
                            : "bg-gray-50 border-gray-100"
                        )}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">แชร์โพสต์จากชุมชน</p>
                          <div className="flex gap-2">
                            {msg.sharedPost.images?.[0] && (
                              <img 
                                src={msg.sharedPost.images[0]} 
                                alt="Post" 
                                className="w-12 h-12 rounded-lg object-cover bg-gray-200"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold line-clamp-1">{msg.sharedPost.authorName}</p>
                              <p className="text-[11px] line-clamp-2 opacity-80">{msg.sharedPost.content}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className={cn(
                      "text-[9px] font-bold text-gray-400",
                      msg.senderId === user?.uid ? "text-right mr-1" : "text-left ml-1"
                    )}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
            />
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
          <button className="p-3 bg-gray-100 text-[#5A5A40] rounded-2xl hover:bg-gray-200 transition-colors"><Plus className="w-6 h-6" /></button>
          <div className="relative flex-1">
            <input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="พิมพ์ข้อความ..."
              className="w-full bg-gray-100 rounded-2xl px-4 py-3 outline-none text-sm focus:ring-2 focus:ring-[#5A5A40]/30 transition-all"
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-3 bg-[#5A5A40] text-white rounded-2xl shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="pt-2 flex flex-col gap-4">
        <h2 className="text-2xl font-black">กล่องข้อความ</h2>
        
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl self-start">
          {(['all', 'private', 'groups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                activeTab === tab ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
              )}
            >
              {tab === 'all' ? 'ทั้งหมด' : tab === 'private' ? 'ส่วนตัว' : 'กลุ่ม'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            placeholder="ค้นหาแชท..." 
            className="w-full bg-white border border-[#5A5A40]/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm focus:ring-2 focus:ring-[#5A5A40]/10"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredChats.map(chat => (
          <motion.button
            key={chat.id}
            whileHover={{ y: -2 }}
            onClick={() => setSelectedChat(chat)}
            className="w-full bg-white p-4 rounded-3xl border border-[#5A5A40]/10 flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className={cn(
              "w-14 h-14 rounded-full overflow-hidden shrink-0 border border-black/5",
              chat.isGroup ? "bg-green-50" : "bg-gray-50"
            )}>
              <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h4 className="font-bold text-[15px] truncate text-[#1a1a1a]">{chat.name}</h4>
                <span className="text-[10px] font-bold text-gray-400">{chat.time}</span>
              </div>
              <p className="text-xs text-gray-500 truncate leading-snug">{chat.lastMessage}</p>
            </div>
            {chat.unread && (
              <div className="w-5 h-5 bg-[#5A5A40] text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                {chat.unread}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function MessageCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/>
    </svg>
  );
}
