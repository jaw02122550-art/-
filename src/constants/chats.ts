export interface ChatPreview {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  unread?: number;
  isGroup?: boolean;
}

export const MOCK_CHATS: ChatPreview[] = [
  { id: 'public-hall', name: 'ห้องประชุมกลาง เกษตรกรไทย', lastMessage: 'ยินดีต้อนรับสมาชิกใหม่ทุกท่านครับ', time: 'ตอนนี้', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=public', isGroup: true },
  { id: 'herbal-group', name: 'คนรักสมุนไพรพื้นบ้าน', lastMessage: 'ใครมีสูตรแก้ปวดข้อบ้างครับ?', time: '11:20', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=herbs', isGroup: true },
  { id: '1', name: 'ลุงสมชาย (สกลนคร)', lastMessage: 'ขอบคุณสำหรับสูตรปุ๋ยครับลูก', time: '10:30', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
  { id: '2', name: 'ป้าพร (เชียงใหม่)', lastMessage: 'ส่งของให้พรุ่งนี้นะคะ', time: '09:15', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
];
