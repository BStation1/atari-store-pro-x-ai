/**
 * TopBar Component (Phase 3UI.0 - Premium Design System)
 * Top navigation bar featuring real-time Arabic clock, system sync status indicator, search trigger, notifications, and user account menu.
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  ChevronDown,
  User as UserIcon,
  KeyRound,
  LogOut,
  ShieldCheck,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import SearchInput from '../common/SearchInput';
import IconButton from '../common/IconButton';
import StatusBadge from '../common/StatusBadge';
import { ROLE_LABELS_AR } from '../../lib/authPermissions';

export interface TopBarProps {
  currentUser: any;
  onOpenMobileSidebar: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  totalNotifications: number;
  onOpenProfileModal: () => void;
  onLogout: () => void;
  onLogoutAllDevices: () => void;
  onNavigate: (viewId: string) => void;
  syncStatus?: {
    isOnline: boolean;
    pendingCount: number;
    lastSyncTime?: string | null;
  };
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onOpenMobileSidebar,
  onOpenSearch,
  onOpenNotifications,
  totalNotifications,
  onOpenProfileModal,
  onLogout,
  onLogoutAllDevices,
  onNavigate,
  syncStatus = { isOnline: true, pendingCount: 0 }
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('');

  // Update Live Arabic Date and Time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        const formatted = now.toLocaleDateString('ar-EG', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setCurrentTimeFormatted(formatted);
      } catch {
        setCurrentTimeFormatted(now.toLocaleString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0d0f19]/90 border-b border-slate-800/80 px-4 sm:px-6 py-3 backdrop-blur-md flex items-center justify-between gap-3">
      {/* Right Side Controls: Mobile Menu Toggle, Quick Search, Quick Action */}
      <div className="flex items-center gap-3">
        {/* Mobile Sidebar Toggle Button */}
        <button
          onClick={onOpenMobileSidebar}
          aria-label="فتح القائمة الجانبية"
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Quick Search Input Trigger */}
        <SearchInput
          onClick={onOpenSearch}
          readOnly
          shortcutHint="Ctrl+K"
          className="hidden md:flex w-52 lg:w-64"
        />

        {/* Quick Reception Action Button */}
        <button
          onClick={() => onNavigate('reception')}
          className="hidden sm:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold transition shadow-md border border-indigo-400/30 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>استقبال صيانة</span>
        </button>
      </div>

      {/* Left Side Info: Arabic Date & Time, Sync Status, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Live Arabic Date & Time Display */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 font-medium">
          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{currentTimeFormatted}</span>
        </div>

        {/* Sync Status Badge (Real System Data) */}
        <div className="hidden sm:block">
          {syncStatus.isOnline ? (
            <StatusBadge
              label={syncStatus.pendingCount > 0 ? `معلّق (${syncStatus.pendingCount})` : 'متزامن'}
              variant={syncStatus.pendingCount > 0 ? 'warning' : 'success'}
              icon={
                syncStatus.pendingCount > 0 ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )
              }
              size="sm"
            />
          ) : (
            <StatusBadge
              label="غير متصل"
              variant="danger"
              icon={<AlertTriangle className="w-3 h-3" />}
              size="sm"
            />
          )}
        </div>

        {/* Notifications Icon Button */}
        <IconButton
          icon={<Bell className="w-4 h-4 text-indigo-400" />}
          ariaLabel="التنبيهات والإشعارات"
          badgeCount={totalNotifications}
          onClick={onOpenNotifications}
        />

        {/* User Account Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="قائمة المستخدم"
            aria-expanded={isUserMenuOpen}
            className="flex items-center gap-2.5 hover:bg-slate-900/80 p-1.5 rounded-xl transition cursor-pointer border border-transparent hover:border-slate-800 focus-ring-custom"
          >
            <div className="text-right hidden sm:block">
              <h4 className="text-xs font-bold text-slate-100 leading-tight">
                {currentUser?.fullName || currentUser?.name || 'مستخدم'}
              </h4>
              <span className="text-[10px] text-indigo-400 block mt-0.5 font-bold">
                {ROLE_LABELS_AR[currentUser?.roleId] || currentUser?.roleId || 'مستخدم'}
              </span>
            </div>
            <img
              src={
                currentUser?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
              }
              alt={currentUser?.fullName || currentUser?.name || 'صورة المستخدم'}
              className="w-8 h-8 rounded-full object-cover border border-indigo-500/30"
            />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Menu Dropdown Panel */}
          {isUserMenuOpen && (
            <div className="absolute left-0 mt-2 w-56 bg-[#0d0f19] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800">
              <div className="px-4 py-2 text-right">
                <p className="text-xs font-bold text-slate-100 truncate">
                  {currentUser?.fullName || currentUser?.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  @{currentUser?.username || 'user'}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenProfileModal();
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-slate-300 hover:bg-indigo-600/10 hover:text-white flex items-center gap-2 cursor-pointer transition"
                >
                  <UserIcon className="w-4 h-4 text-indigo-400" />
                  <span>الملف الشخصي والحساب</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenProfileModal();
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-slate-300 hover:bg-indigo-600/10 hover:text-white flex items-center gap-2 cursor-pointer transition"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>تغيير كلمة المرور</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogoutAllDevices();
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-slate-400 hover:bg-slate-900 flex items-center gap-2 cursor-pointer transition"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>تسجيل الخروج من كافة الأجهزة</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
