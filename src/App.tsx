/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Warehouse,
  DollarSign,
  TrendingUp,
  Settings,
  PlusCircle,
  FileText,
  Search,
  Bell,
  CheckCircle2,
  Menu,
  X,
  User as UserIcon,
  Smartphone,
  Sparkles,
  PieChart,
  LogOut,
  ShieldCheck,
  ChevronDown,
  KeyRound
} from "lucide-react";
import { db } from "./lib/db";
import { authStore } from "./lib/authStore";
import { hasPermission, getViewRequiredPermission, ROLE_LABELS_AR } from "./lib/authPermissions";
import { useCurrentUser, useSettings, useProducts, useRepairOrders } from "./hooks/useData";

// Views & Modals
import { DialogProvider } from "./context/DialogContext";
import Dashboard from "./components/Dashboard";
import Reception from "./components/Reception";
import CustomersList from "./components/CustomersList";
import RepairCenter from "./components/RepairCenter";
import Inventory from "./components/Inventory";
import Accounting from "./components/Accounting";
import PartnerDashboard from "./components/partner-accounting/PartnerDashboard";
import Reports from "./components/Reports";
import UsersList from "./components/Users";
import SettingsView from "./components/Settings";
import SystemHealthDashboard from "./components/SystemHealthDashboard";
import TrackingPage from "./components/TrackingPage";
import AIDiagnostics from "./components/AIDiagnostics";
import NotificationsDrawer from "./components/NotificationsDrawer";
import Login from "./components/Login";
import InitialSetup from "./components/InitialSetup";
import Unauthorized from "./components/Unauthorized";
import ForcePasswordChangeModal from "./components/ForcePasswordChangeModal";
import UserProfileModal from "./components/UserProfileModal";

function MainApp() {
  // Initialize Database once on boot & check URL parameters
  useEffect(() => {
    db.init();

    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const queryView = urlParams.get("view");
      const trackId = urlParams.get("id") || urlParams.get("orderId") || urlParams.get("track") || urlParams.get("token") || urlParams.get("phone");

      if (pathname.includes("/login")) {
        setCurrentView("login");
      } else if (pathname.includes("/unauthorized")) {
        setCurrentView("unauthorized");
      } else if (queryView === "tracking" || trackId || pathname.includes("/track")) {
        setCurrentView("tracking");
        if (trackId) {
          setNavigationParams({ initialQuery: trackId });
        }
      }
    }
  }, []);

  const { user: currentLoggedUser } = useCurrentUser();
  const { settings } = useSettings();
  const { products } = useProducts();
  const { orders } = useRepairOrders();

  // Navigation and view state
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [postLoginRedirect, setPostLoginRedirect] = useState<string>("dashboard");

  // Notifications Drawer state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // User Dropdown and Profile Modal states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Responsive Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Quick Command Search Modal (Ctrl+K)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState("");

  // Notifications calculation
  const [notificationsTick, setNotificationsTick] = useState(0);
  const handleRefreshNotifications = () => setNotificationsTick(prev => prev + 1);

  const notificationsList = React.useMemo(() => {
    return db.getNotifications();
  }, [notificationsTick, products, orders]);

  const totalNotifications = notificationsList.filter(n => !n.isRead).length;

  // Keyboard Shortcuts Listeners (Ctrl+N, Ctrl+S, Ctrl+K)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        handleNavigate("reception");
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleNavigate("settings");
      }
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => {
      window.removeEventListener("keydown", handleShortcuts);
    };
  }, []);

  const handleNavigate = (view: string, params: any = null) => {
    // If navigating to internal page and not logged in, redirect to login
    const isPublic = view === "tracking" || view === "login" || view === "setup" || view === "unauthorized";
    if (!isPublic && !currentLoggedUser) {
      setPostLoginRedirect(view);
      setCurrentView("login");
      return;
    }

    setCurrentView(view);
    setNavigationParams(params);
    setIsSidebarOpen(false);
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
    setCmdSearchQuery("");
  };

  const handleLogout = () => {
    authStore.logout();
    setIsUserMenuOpen(false);
    setIsProfileModalOpen(false);
    setCurrentView("login");
  };

  const handleLogoutAllDevices = () => {
    if (currentLoggedUser) {
      authStore.logoutAllSessions(currentLoggedUser.id);
    }
    handleLogout();
  };

  // Full Menu Items Definitions
  const allMenuItems = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { id: "reception", label: "الاستقبال وتسجيل الأجهزة", icon: PlusCircle },
    { id: "customers", label: "حسابات العملاء", icon: Users },
    { id: "repair-center", label: "مركز الصيانة والورشة", icon: Wrench },
    { id: "ai-diagnostics", label: "تشخيص الأعطال الذكي AI", icon: Sparkles },
    { id: "inventory", label: "المخزون والمستودع", icon: Warehouse },
    { id: "accounting", label: "المبيعات والمحاسبة", icon: DollarSign },
    { id: "partner-accounting", label: "محاسبة الشركاء", icon: PieChart },
    { id: "reports", label: "التقارير المالية", icon: TrendingUp },
    { id: "system-health", label: "سلامة وجاهزية النظام", icon: ShieldCheck },
    { id: "users", label: "المستخدمين والأمن", icon: UserIcon },
    { id: "tracking", label: "بوابة تتبع العملاء", icon: Smartphone },
    { id: "settings", label: "إعدادات النظام الفنية", icon: Settings }
  ];

  // Filter menu items based on permissions (Requirement 17)
  const allowedMenuItems = allMenuItems.filter(item => {
    if (item.id === "tracking") return true; // Public tracking page
    if (!currentLoggedUser) return false;
    const reqPerm = getViewRequiredPermission(item.id);
    if (!reqPerm) return true;
    return hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, reqPerm);
  });

  // Check if system has no owner
  const hasOwner = authStore.hasOwner();

  // If viewing public tracking page, render directly without login wrapper
  if (currentView === "tracking") {
    return <TrackingPage initialQuery={navigationParams?.initialQuery} />;
  }

  // If setup flow is requested or system has no owner and user is on setup
  if (currentView === "setup" || (!hasOwner && currentView !== "login")) {
    return (
      <InitialSetup
        onSuccess={() => {
          setCurrentView("dashboard");
        }}
        onCancel={() => {
          setCurrentView("login");
        }}
      />
    );
  }

  // If user is not logged in, render Login View
  if (!currentLoggedUser || currentView === "login") {
    return (
      <Login
        onSuccess={() => {
          const target = postLoginRedirect || "dashboard";
          setCurrentView(target);
        }}
        onNavigateToSetup={() => {
          setCurrentView("setup");
        }}
      />
    );
  }

  // Check view permissions
  const requiredPerm = getViewRequiredPermission(currentView);
  const isAuthorized =
    !requiredPerm ||
    hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, requiredPerm);

  // Render view router
  const renderViewContent = () => {
    if (!isAuthorized) {
      return (
        <Unauthorized
          requiredPermission={requiredPerm}
          onReturnHome={() => setCurrentView("dashboard")}
        />
      );
    }

    switch (currentView) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "reception":
        return <Reception prefillData={navigationParams?.prefillData} onNavigate={handleNavigate} />;
      case "customers":
        return (
          <CustomersList
            initialOpenAddModal={navigationParams?.openAddModal}
            initialFocusSearch={navigationParams?.focusSearch}
          />
        );
      case "repair-center":
        return (
          <RepairCenter
            initialStatusFilter={navigationParams?.status}
            initialOrderId={navigationParams?.orderId}
          />
        );
      case "ai-diagnostics":
        return (
          <AIDiagnostics
            onNavigateToReception={prefillData =>
              handleNavigate("reception", { prefillData })
            }
          />
        );
      case "inventory":
        return <Inventory initialSearch={navigationParams?.search} />;
      case "accounting":
        return <Accounting openInvoiceModal={navigationParams?.openInvoiceModal} />;
      case "partner-accounting":
        return <PartnerDashboard currentUserId={currentLoggedUser.id} />;
      case "reports":
        return <Reports />;
      case "system-health":
        return <SystemHealthDashboard />;
      case "users":
        return <UsersList />;
      case "settings":
        return <SettingsView />;
      case "unauthorized":
        return <Unauthorized onReturnHome={() => setCurrentView("dashboard")} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const commandSearchResults = cmdSearchQuery.trim()
    ? allowedMenuItems.filter(item => item.label.includes(cmdSearchQuery))
    : allowedMenuItems;

  return (
    <div className="min-h-screen bg-[#070913] text-gray-100 font-sans flex overflow-hidden dir-rtl">
      {/* Force Password Change Modal */}
      {currentLoggedUser.mustChangePassword && (
        <ForcePasswordChangeModal
          userId={currentLoggedUser.id}
          onSuccess={() => {
            // Trigger auth refresh
            window.dispatchEvent(new Event("atari_auth_changed"));
          }}
        />
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        user={currentLoggedUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        onLogoutAllDevices={handleLogoutAllDevices}
      />

      {/* 1. Global Command Palette Modal (Ctrl+K) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-right">
            <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400">البحث السريع والتنقل باللوحة</span>
              <button onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="اكتب القسم المراد الوصول إليه... (مثال: مخزون، صيانة)"
                  value={cmdSearchQuery}
                  onChange={e => setCmdSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 pr-9"
                />
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pt-2">
                {commandSearchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className="w-full text-right px-4 py-3 rounded-xl hover:bg-indigo-600/10 text-xs text-gray-300 transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <item.icon className="w-4 h-4 text-indigo-400" />
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-500">انتقال سريع</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-[#11131e] border-l border-[#2a2d42]/70 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo & title header */}
          <div className="p-6 border-b border-[#2a2d42]/40 flex justify-between items-center bg-[#070913]/20">
            <div>
              <h1 className="text-lg font-black text-indigo-400 tracking-tight font-sans">
                {settings.companyName || "Atari Store Pro X"}
              </h1>
              <p className="text-[10px] text-indigo-300 font-medium mt-1">نظام إدارة مراكز الصيانة والـ ERP</p>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-white cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Allowed Menu Items Loop */}
          <nav className="p-4 space-y-1">
            {allowedMenuItems.map(item => {
              const isSelected = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40 glow-primary"
                      : "text-gray-400 hover:text-white hover:bg-[#1a1d2e]/40"
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-gray-500"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Branch Block */}
        <div className="p-5 border-t border-[#2a2d42]/50 bg-[#0c0d15] space-y-3">
          <div className="flex items-center justify-between text-xs bg-gray-950/60 p-3 rounded-xl border border-[#2a2d42]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-gray-400 font-medium">الفرع الرئيسي</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
              آمن ومحمي
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500">
            <span>الإصدار 2.0 (RBAC Pro)</span>
            <span>© {new Date().getFullYear()} Atari Pro X</span>
          </div>
        </div>
      </aside>

      {/* 3. Main Content Container Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header navbar */}
        <header className="bg-[#11131e]/50 border-b border-[#2a2d42]/50 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-gray-400 hover:text-white cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>

            {/* Instant Navigation Search Box */}
            <div className="hidden md:flex items-center gap-3 bg-gray-950/60 border border-[#2a2d42] px-3.5 py-2 rounded-xl">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                readOnly
                onClick={() => setIsSearchOpen(true)}
                placeholder="ابحث بالنظام...  Ctrl+K"
                className="bg-transparent text-xs text-gray-400 focus:outline-none placeholder-gray-500 w-44 cursor-pointer"
              />
            </div>

            {/* Quick Reception Action Button */}
            <button
              onClick={() => handleNavigate("reception")}
              className="hidden sm:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2 rounded-xl font-bold transition-all shadow-md shadow-indigo-950/40 cursor-pointer border border-indigo-400/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>استقبال صيانة</span>
            </button>
          </div>

          {/* User profile & Notifications */}
          <div className="flex items-center gap-4">
            {/* Notifications Alert Icon */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2.5 bg-gray-950/50 border border-[#2a2d42] text-gray-400 hover:text-white rounded-xl relative cursor-pointer hover:border-indigo-500/50 transition-colors"
              title="التنبيهات والإشعارات"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              {totalNotifications > 0 && (
                <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full absolute -top-1 -right-1 flex items-center justify-center px-1 border border-gray-950 animate-pulse">
                  {totalNotifications}
                </span>
              )}
            </button>

            {/* User Profile Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 hover:bg-gray-950/60 p-1.5 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-[#2a2d42]"
              >
                <div className="text-right">
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {currentLoggedUser.fullName || currentLoggedUser.name}
                  </h4>
                  <span className="text-[10px] text-indigo-400 block mt-0.5 font-bold">
                    {ROLE_LABELS_AR[currentLoggedUser.roleId] || currentLoggedUser.roleId}
                  </span>
                </div>
                <img
                  src={
                    currentLoggedUser.avatarUrl ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                  }
                  alt={currentLoggedUser.fullName || currentLoggedUser.name}
                  className="w-9 h-9 rounded-full object-cover border border-indigo-500/30"
                />
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {/* User Dropdown Options */}
              {isUserMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-[#11131e] border border-[#2a2d42] rounded-2xl shadow-2xl py-2 z-50 divide-y divide-[#2a2d42]">
                  <div className="px-4 py-2.5">
                    <p className="text-xs font-bold text-white truncate">{currentLoggedUser.fullName || currentLoggedUser.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">@{currentLoggedUser.username}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-gray-300 hover:bg-indigo-600/10 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-indigo-400" />
                      <span>الملف الشخصي والحساب</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-gray-300 hover:bg-indigo-600/10 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>تغيير كلمة المرور</span>
                    </button>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-right px-4 py-2 text-xs text-red-400 hover:bg-red-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>

                    <button
                      onClick={handleLogoutAllDevices}
                      className="w-full text-right px-4 py-2 text-xs text-gray-400 hover:bg-gray-900 flex items-center gap-2 cursor-pointer transition-colors"
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

        {/* Dynamic View rendering */}
        <main className="p-6 flex-1 max-w-[1600px] w-full mx-auto leading-relaxed">
          {renderViewContent()}
        </main>
      </div>

      {/* Global Root-Level Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notificationsList}
        onRefresh={handleRefreshNotifications}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <MainApp />
    </DialogProvider>
  );
}
