/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  MessageSquare, 
  Users, 
  ShoppingBag, 
  Gamepad2, 
  User as UserIcon,
  Leaf,
  Bot,
  Calculator
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AIAssistantPage from './pages/AIAssistantPage';
import CommunityPage from './pages/CommunityPage';
import MarketplacePage from './pages/MarketplacePage';
import MiniGamePage from './pages/MiniGamePage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import AccountingPage from './pages/AccountingPage';
import SystemHealthPage from './pages/SystemHealthPage';
import { cn } from './lib/utils';
import NotificationManager from './components/NotificationManager';
import { Activity } from 'lucide-react';

type Page = 'home' | 'ai' | 'community' | 'market' | 'game' | 'profile' | 'chat' | 'accounting' | 'health';

export default function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) setCurrentPage(e.detail);
    };
    window.addEventListener('app-navigate', handleNavigate);
    return () => window.removeEventListener('app-navigate', handleNavigate);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f5f5f0]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Leaf className="w-12 h-12 text-[#5A5A40]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'ai': return <AIAssistantPage />;
      case 'community': return <CommunityPage />;
      case 'market': return <MarketplacePage />;
      case 'game': return <MiniGamePage />;
      case 'profile': return <ProfilePage />;
      case 'chat': return <ChatPage />;
      case 'accounting': return <AccountingPage />;
      case 'health': return <SystemHealthPage />;
      default: return <HomePage />;
    }
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'หน้าแรก' },
    { id: 'ai', icon: Bot, label: 'ผู้ช่วย AI' },
    { id: 'community', icon: Users, label: 'ชุมชน' },
    { id: 'market', icon: ShoppingBag, label: 'ตลาด' },
    { id: 'game', icon: Gamepad2, label: 'ฟาร์ม' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f0] font-sans selection:bg-[#5A5A40]/30">
      <NotificationManager userId={user.uid} />
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#5A5A40]/10 shrink-0">
        <div className="flex items-center gap-2">
          <Leaf className="w-8 h-8 text-[#5A5A40]" />
          <h1 className="text-xl font-bold text-[#1a1a1a] tracking-tight">เกษตรกรไทย</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentPage('chat')}
            className={cn(
              "p-2 rounded-full transition-colors",
              currentPage === 'chat' ? "bg-[#5A5A40] text-white" : "hover:bg-[#5A5A40]/10 text-[#5A5A40]"
            )}
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setCurrentPage('accounting')}
            className={cn(
              "p-2 rounded-full transition-colors",
              currentPage === 'accounting' ? "bg-[#5A5A40] text-white" : "hover:bg-[#5A5A40]/10 text-[#5A5A40]"
            )}
          >
            <Calculator className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setCurrentPage('health')}
            className={cn(
              "p-2 rounded-full transition-colors",
              currentPage === 'health' ? "bg-[#5A5A40] text-white" : "hover:bg-[#5A5A40]/10 text-[#5A5A40]"
            )}
            title="ระบบอัจฉริยะ"
          >
            <Activity className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setCurrentPage('profile')}
            className={cn(
              "p-2 rounded-full transition-colors",
              currentPage === 'profile' ? "bg-[#5A5A40] text-white" : "hover:bg-[#5A5A40]/10 text-[#5A5A40]"
            )}
          >
            <UserIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-4xl mx-auto w-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#5A5A40]/10 px-6 py-3 shrink-0 flex justify-between items-center z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id as Page)}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-all",
              currentPage === item.id 
                ? "text-[#5A5A40] scale-110" 
                : "text-gray-400 hover:text-[#5A5A40]/70"
            )}
          >
            <item.icon className={cn("w-7 h-7", currentPage === item.id && "fill-current")} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

