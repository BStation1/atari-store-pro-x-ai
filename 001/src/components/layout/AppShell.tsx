/**
 * AppShell Component (Phase 3UI.0 - RTL Application Shell)
 * Main layout wrapper featuring RightSidebar on the right, TopBar at top, and main scrollable content area.
 * Utilizes CSS logical properties for true RTL alignment.
 * @license Apache-2.0
 */

import React, { useState } from 'react';
import RightSidebar, { MenuItem } from './RightSidebar';
import TopBar from './TopBar';

export interface AppShellProps {
  allowedMenuItems: MenuItem[];
  currentView: string;
  onNavigate: (viewId: string) => void;
  currentUser: any;
  totalNotifications: number;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfileModal: () => void;
  onLogout: () => void;
  onLogoutAllDevices: () => void;
  syncStatus?: {
    isOnline: boolean;
    pendingCount: number;
    lastSyncTime?: string | null;
  };
  children: React.ReactNode;
  companyName?: string;
  bannerNotification?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  allowedMenuItems,
  currentView,
  onNavigate,
  currentUser,
  totalNotifications,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfileModal,
  onLogout,
  onLogoutAllDevices,
  syncStatus,
  children,
  companyName,
  bannerNotification
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-[#070913] text-slate-100 font-sans flex overflow-hidden">
      {/* 1. Right Sidebar (Right side in RTL) */}
      <RightSidebar
        allowedMenuItems={allowedMenuItems}
        currentView={currentView}
        onNavigate={onNavigate}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        companyName={companyName}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Banner Notification Slot (e.g., Supabase setup alert) */}
        {bannerNotification}

        {/* Top Header Bar */}
        <TopBar
          currentUser={currentUser}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSearch={onOpenSearch}
          onOpenNotifications={onOpenNotifications}
          totalNotifications={totalNotifications}
          onOpenProfileModal={onOpenProfileModal}
          onLogout={onLogout}
          onLogoutAllDevices={onLogoutAllDevices}
          onNavigate={onNavigate}
          syncStatus={syncStatus}
        />

        {/* Page Content View */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto leading-relaxed">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
