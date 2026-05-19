import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Plus, 
  Trash2,
  Image as ImageIcon,
  Tag,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { useAuth } from '../hooks/useAuth';
import { cn, compressImage, calculateTotalBase64Size } from '../lib/utils';
import UserDiscovery from '../components/UserDiscovery';
import FriendRequests from '../components/FriendRequests';

const CATEGORIES = ["สมุนไพร", "ผัก", "ผลไม้", "ปศุสัตว์", "ทั่วไป"];

function ImageCarousel({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  const slideLeft = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const slideRight = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (images.length === 1) {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          src={images[0]} 
          alt="Post content" 
          className="w-full h-auto max-h-[500px] object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 1.1
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95
    })
  };

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-gray-100 aspect-square sm:aspect-video md:max-h-[500px] bg-black/5 touch-none">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.4 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(_, info) => {
            const swipe = info.offset.x;
            if (swipe > 50) slideLeft();
            else if (swipe < -50) slideRight();
          }}
          className="absolute inset-0 w-full h-full"
        >
          <motion.img
            src={images[currentIndex]}
            className="w-full h-full object-cover"
            loading="lazy"
            initial={{ x: direction * 50 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
          {/* Subtle Parallax Layer Overlay */}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons - Hidden on Mobile but visible on Hover/PC */}
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); slideLeft(); }}
          className="p-2 rounded-full bg-white/90 text-[#5A5A40] shadow-md pointer-events-auto hover:bg-white transition-all transform hover:scale-110 active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); slideRight(); }}
          className="p-2 rounded-full bg-white/90 text-[#5A5A40] shadow-md pointer-events-auto hover:bg-white transition-all transform hover:scale-110 active:scale-95"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Modern Badge for Image Count */}
      <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/30 backdrop-blur-md rounded-full text-[10px] font-black text-white/90 tracking-widest uppercase pointer-events-none">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 bg-black/20 backdrop-blur-sm rounded-full">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setDirection(idx > currentIndex ? 1 : -1);
              setCurrentIndex(idx);
            }}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-300",
              currentIndex === idx ? "bg-white w-4" : "bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  images?: string[];
  likesCount: number;
  commentsCount: number;
  category: string;
  createdAt: any;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: any;
}

function CommentSection({ postId, postAuthorId, postContent, user, profile }: { postId: string, postAuthorId: string, postContent: string, user: any, profile: any }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const commentsPath = `posts/${postId}/comments`;
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(commentsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, commentsPath);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    const commentsPath = `posts/${postId}/comments`;
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        authorId: user.uid,
        authorName: profile?.displayName || 'เกษตรกรไทย',
        authorPhoto: profile?.photoURL || '',
        content: commentText,
        createdAt: serverTimestamp()
      });
      
      // Update comment count on post
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });

      // Create notification for post author
      if (postAuthorId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: postAuthorId,
          type: 'comment',
          title: 'ความคิดเห็นใหม่',
          message: `${profile?.displayName || 'เกษตรกรไทย'} แสดงความคิดเห็นในโพสต์ของคุณ: "${commentText.substring(0, 30)}..."`,
          read: false,
          relatedId: postId,
          createdAt: serverTimestamp()
        });
      }

      setCommentText("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, commentsPath);
    }
  };

  return (
    <div className="bg-gray-50/50 p-4 space-y-4 border-t border-gray-100">
      {/* Comment Input */}
      {user && (
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1">
            {profile?.photoURL && <img src={profile.photoURL} alt="Me" />}
          </div>
          <div className="flex-1 relative">
            <input 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="แสดงความคิดเห็น..."
              className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-4 pr-10 text-sm focus:ring-1 focus:ring-[#5A5A40] outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button 
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5A40] disabled:opacity-30"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-gray-400 font-bold text-center py-2 uppercase tracking-widest">ยังไม่มีความคิดเห็น</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-50 overflow-hidden shrink-0 border border-black/5">
                <img src={comment.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`} alt={comment.authorName} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[12px]">{comment.authorName}</span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                    {comment.createdAt?.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-white p-2.5 rounded-2xl rounded-tl-none shadow-sm inline-block min-w-[60px]">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { socket } from '../lib/socket';
import { MOCK_CHATS } from '../constants/chats';

function ShareModal({ post, onClose, user }: { post: Post, onClose: () => void, user: any }) {
  const handleShare = async (chatId: string) => {
    if (!user) return;
    
    // Connect socket if needed
    if (!socket.connected) {
      socket.connect();
    }

    const shareData = {
      text: `ลองดูโพสต์นี้สิ: ${post.content.substring(0, 30)}...`,
      senderId: user.uid,
      senderName: user.displayName || 'เกษตรกรไทย',
      createdAt: serverTimestamp(),
      sharedPost: {
        id: post.id,
        content: post.content,
        authorName: post.authorName,
        images: post.images || []
      }
    };

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), shareData);
      
      // Also emit via socket for real-time update if the other user is online
      if (socket.connected) {
        socket.emit('send-message', { ...shareData, roomId: chatId, createdAt: new Date().toISOString() });
      }

      onClose();
    } catch (error) {
      console.error('Error sharing post:', error);
      alert('เกิดข้อผิดพลาดในการแชร์โพสต์');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-black">แชร์ไปที่แชท</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">เลือกผู้รับหรือกลุ่ม</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1 no-scrollbar">
          {MOCK_CHATS.map(chat => (
            <button
              key={chat.id}
              onClick={() => handleShare(chat.id)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-50 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-black/5 bg-gray-50 shrink-0">
                <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-bold text-sm truncate group-hover:text-[#5A5A40] transition-colors">{chat.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{chat.isGroup ? 'แชทกลุ่ม' : 'ออนไลน์'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#5A5A40] group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 opacity-60">
            {post.images?.[0] && <img src={post.images[0]} className="w-10 h-10 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50">โพสต์ของ {post.authorName}</p>
              <p className="text-xs truncate">{post.content}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CommunityPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  useEffect(() => {
    const postsPath = 'posts';
    setLoading(true);
    const q = query(collection(db, postsPath), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, postsPath);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePost = async () => {
    if ((!newPost.trim() && selectedImages.length === 0) || !user) return;
    const postsPath = 'posts';

    // Safety check for total document size
    const totalImageSize = calculateTotalBase64Size(selectedImages);
    if (totalImageSize > 800000) {
      alert(`ขนาดรูปภาพรวมกันใหญ่เกินไป (${(totalImageSize/1024).toFixed(0)}KB characters) กรุณาลบออกบางรูปหรือลดคุณภาพภาพ`);
      return;
    }

    try {
      await addDoc(collection(db, postsPath), {
        authorId: user.uid,
        authorName: profile?.displayName || 'เกษตรกรไทย',
        authorPhoto: profile?.photoURL || '',
        content: newPost,
        images: selectedImages,
        likesCount: 0,
        commentsCount: 0,
        category: activeCategory === "ทั้งหมด" ? "ทั่วไป" : activeCategory,
        createdAt: serverTimestamp()
      });
      setNewPost("");
      setSelectedImages([]);
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, postsPath);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 4) {
      alert("คุณสามารถอัปโหลดรูปภาพได้สูงสุด 4 รูป");
      return;
    }

    const currentTotalSize = calculateTotalBase64Size(selectedImages);
    if (currentTotalSize > 750000) {
        alert("ขนาดรูปภาพรวมปัจจุบันใกล้เต็มขีดจำกัดแล้ว กรุณาลบรูปเดิมก่อนเพิ่มใหม่");
        return;
    }

    for (const file of files) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        // Compress aggressively for community feed
        const compressed = await compressImage(base64, 600, 600, 0.4);
        
        // Double check individual size
        if (compressed.length > 250000) {
            const superCompressed = await compressImage(base64, 400, 400, 0.2);
            setSelectedImages(prev => [...prev, superCompressed]);
        } else {
            setSelectedImages(prev => [...prev, compressed]);
        }
      } catch (err) {
        console.error("Compression error:", err);
        alert("ไม่สามารถอัปโหลดรูปนี้ได้ กรุณาลองใช้รูปอื่น");
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLike = async (postId: string) => {
    // OPTIMISTIC UPDATE: Update local state immediately
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p
    ));

    const postRef = doc(db, 'posts', postId);
    try {
      await updateDoc(postRef, {
        likesCount: increment(1)
      });
    } catch (error) {
      // Rollback on failure
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, likesCount: p.likesCount - 1 } : p
      ));
      console.error("Like error:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์นี้?')) {
      const postPath = `posts/${postId}`;
      try {
        await deleteDoc(doc(db, 'posts', postId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, postPath);
      }
    }
  };

  const filteredPosts = activeCategory === "ทั้งหมด" 
    ? posts 
    : posts.filter(p => p.category === activeCategory);

  return (
    <div className="p-4 space-y-6">
      {/* Search & Categories */}
      <section className="space-y-4 pt-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            placeholder="ค้นหาเพื่อนและเกษตรกร..." 
            className="w-full bg-white border border-[#5A5A40]/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {["ทั้งหมด", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                activeCategory === cat 
                  ? "bg-[#5A5A40] text-white shadow-md shadow-[#5A5A40]/20 scale-105" 
                  : "bg-white text-[#5A5A40] border border-[#5A5A40]/10 hover:bg-[#5A5A40]/5"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Friend Requests */}
      <FriendRequests />

      {/* People You May Know */}
      <UserDiscovery />

      {/* Create Post Button/Input */}
      {!isCreating ? (
        <button 
          onClick={() => setIsCreating(true)}
          className="w-full bg-white p-4 rounded-2xl border border-[#5A5A40]/10 flex items-center gap-4 text-gray-400 group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden shrink-0">
            {profile?.photoURL && <img src={profile.photoURL} alt="Me" />}
          </div>
          <span className="text-sm font-medium">แบ่งปันความรู้เกษตรของคุณวันนี้...</span>
          <Plus className="ml-auto w-6 h-6 text-[#5A5A40]/40 group-hover:text-[#5A5A40]" />
        </button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 rounded-2xl border-2 border-[#5A5A40]/20 space-y-4 shadow-xl"
        >
          <textarea
            autoFocus
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="เขียนอะไรบางอย่าง..."
            className="w-full min-h-[120px] outline-none resize-none text-sm bg-transparent"
          />

          <AnimatePresence>
            {selectedImages.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="grid grid-cols-2 gap-2"
              >
                {selectedImages.map((src, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={src} className="w-full h-full object-cover" alt={`Preview ${index}`} />
                    <button 
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#5A5A40] hover:bg-gray-100 rounded-lg flex items-center gap-1.5 px-3"
                title="เพิ่มรูปภาพ"
              >
                <ImageIcon className="w-5 h-5" />
                <span className="text-xs font-bold sm:block hidden">เพิ่มรูป</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                multiple
                onChange={handleImageSelect}
              />
              <button className="p-2 text-[#5A5A40] hover:bg-gray-100 rounded-lg hover:text-green-600">
                <Tag className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setIsCreating(false); setSelectedImages([]); }} className="px-4 py-2 text-sm font-bold text-gray-500">ยกเลิก</button>
              <button 
                onClick={handlePost} 
                disabled={!newPost.trim() && selectedImages.length === 0}
                className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-30 disabled:shadow-none transition-all"
              >
                โพสต์
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {loading ? (
          // Skeleton Feed for better perceived performance
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-4 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                  <div className="h-2 w-16 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-50 rounded" />
                <div className="h-4 w-3/4 bg-gray-50 rounded" />
              </div>
              <div className="aspect-video bg-gray-50 rounded-2xl" />
            </div>
          ))
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
             <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">ไม่พบโพสต์ในหมวดหมู่นี้</p>
          </div>
        ) : (
          filteredPosts.map(post => (
          <motion.article 
            key={post.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-3xl border border-[#5A5A40]/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Post Header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 overflow-hidden shrink-0 border border-black/5">
                <img src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} alt={post.authorName} />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">{post.authorName}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{post.category} • {post.createdAt?.toDate().toLocaleDateString('th-TH')}</p>
              </div>
              {user?.uid === post.authorId && (
                <button 
                  onClick={() => handleDeletePost(post.id)}
                  className="ml-auto p-2 text-gray-300 hover:text-red-500 transition-colors"
                  title="ลบโพสต์"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="px-4 pb-4 space-y-3">
              {post.content && (
                <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">{post.content}</p>
              )}
              
              {post.images && post.images.length > 0 && (
                <ImageCarousel images={post.images} />
              )}
            </div>

            {/* Interaction Footer */}
            <div className="px-4 py-3 bg-[#5A5A40]/5 flex items-center gap-6">
              <button 
                onClick={() => handleLike(post.id)}
                className="flex items-center gap-2 text-[#1a1a1a]/60 hover:text-red-500 transition-colors"
              >
                <Heart className={cn("w-5 h-5", post.likesCount > 0 && "fill-red-500 text-red-500")} />
                <span className="text-xs font-bold">{post.likesCount}</span>
              </button>
              <button 
                onClick={() => toggleComments(post.id)}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  expandedComments[post.id] ? "text-blue-500" : "text-[#1a1a1a]/60 hover:text-blue-500"
                )}
              >
                <MessageCircle className={cn("w-5 h-5", expandedComments[post.id] && "fill-blue-500/10")} />
                <span className="text-xs font-bold">{post.commentsCount}</span>
              </button>
              <button 
                onClick={() => setSharingPost(post)}
                className="flex items-center gap-2 text-[#1a1a1a]/60 hover:text-green-600 transition-colors ml-auto"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Comments Section */}
            <AnimatePresence>
              {expandedComments[post.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <CommentSection 
                    postId={post.id} 
                    postAuthorId={post.authorId}
                    postContent={post.content}
                    user={user} 
                    profile={profile} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        )))}
      </div>

      <AnimatePresence>
        {sharingPost && (
          <ShareModal 
            post={sharingPost} 
            onClose={() => setSharingPost(null)} 
            user={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
