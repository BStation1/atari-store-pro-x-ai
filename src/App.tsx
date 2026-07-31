/**
 * Primary Application Entry Point (Phase 3 Bootstrap Architecture)
 * Single-tier bootstrap initialization via AppDataProvider.
 * Prevents unauthenticated fetches, premature page rendering, and fake zero KPI flashes.
 * @license Apache-2.0
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
  Search,
  User as UserIcon,
  Smartphone,
  Sparkles,
  PieChart,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  X,
  LogOut
} from "lucide-react";
import { db } from "./lib/data";
import { authStore } from "./lib/authStore";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { hasPermission, getViewRequiredPermission } from "./lib/authPermissions";
import { useCurrentUser, useSettings, useProducts, useRepairOrders } from "./hooks/useData";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { DialogProvider } from "./context/DialogContext";

// Views & Modals
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
import AppShell from "./components/layout/AppShell";

function MainApp() {
  const {
    bootstrapState,
    bootstrapError,
    currentUser: currentLoggedUser,
    hasOwner,
    retryBootstrap,
    handleLoginSuccess,
    handleLogout
  } = useAppData();

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

  // Initialize Database & check URL parameters once on boot
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
    const isPublic = view === "tracking" || view === "login" || view === "setup" || view === "unauthorized";
    if (!isPublic && !currentLoggedUser) {
      setPostLoginRedirect(view);
      setCurrentView("login");
      return;
    }

    setCurrentView(view);
    setNavigationParams(params);
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
    setCmdSearchQuery("");
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

  // Filter menu items based on permissions
  const allowedMenuItems = allMenuItems.filter(item => {
    if (item.id === "tracking") return true;
    if (!currentLoggedUser) return false;
    const reqPerm = getViewRequiredPermission(item.id);
    if (!reqPerm) return true;
    return hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, reqPerm);
  });

  // 1. If viewing public tracking page, render directly
  if (currentView === "tracking") {
    return <TrackingPage initialQuery={navigationParams?.initialQuery} />;
  }

  // 2. Loading state while bootstrapping auth or business data
  if (bootstrapState === 'BOOTING' || bootstrapState === 'AUTH_LOADING' || bootstrapState === 'DATA_LOADING') {
    const statusText = bootstrapState === 'DATA_LOADING'
      ? "جاري تحميل وتزامن بيانات النظام الفنية..."
      : "جاري التحقق من جلسة الدخول وصلاحيات النظام...";

    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto shadow-lg shadow-indigo-500/20"></div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">نظام إدارة صيانة أتاري</h3>
            <p className="text-xs text-gray-400 font-bold">{statusText}</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Error state during bootstrap
  if (bootstrapState === 'ERROR' || bootstrapError) {
    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="bg-[#11131e] border border-red-500/30 p-6 max-w-md w-full rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">تعذر تحميل بيانات النظام</h2>
            <p className="text-xs text-red-300 leading-relaxed">
              {bootstrapError || "حدث خطأ أثناء الاتصال بقاعدة البيانات وقراءة البيانات الأولية."}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => retryBootstrap()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </button>
            <button
              onClick={() => handleLogout()}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. If setup flow is requested or system has no owner
  if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login")) {
    return (
      <InitialSetup
        onSuccess={() => {
          retryBootstrap();
          setCurrentView("dashboard");
        }}
        onCancel={() => {
          setCurrentView("login");
        }}
      />
    );
  }

  // 5. If user is not logged in, render Login View
  if (!currentLoggedUser || currentView === "login") {
    return (
      <Login
        onSuccess={async () => {
          const user = authStore.getCurrentUser();
          if (user) await handleLoginSuccess(user);
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
    <>
      {/* Force Password Change Modal */}
      {currentLoggedUser.mustChangePassword && (
        <ForcePasswordChangeModal
          userId={currentLoggedUser.id}
          onSuccess={() => {
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

      {/* 2. RTL Application Shell */}
      <AppShell
        allowedMenuItems={allowedMenuItems}
        currentView={currentView}
        onNavigate={handleNavigate}
        currentUser={currentLoggedUser}
        totalNotifications={totalNotifications}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onLogout={handleLogout}
        onLogoutAllDevices={handleLogoutAllDevices}
        companyName={settings.companyName || "Atari Store"}
        bannerNotification={
          !isSupabaseConfigured ? (
            <div className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 text-xs py-2.5 px-6 flex items-center justify-between font-sans shadow-md dir-rtl">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>تنبيه إعدادات Supabase مفقودة:</strong> لم يتم العثور على <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono">VITE_SUPABASE_URL</code> أو <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>. يرجى إضافتها في Vercel Project Settings → Environment Variables ثم إجراء <strong>Redeploy</strong>.
                </span>
              </div>
            </div>
          ) : undefined
        }
      >
        {renderViewContent()}
      </AppShell>

      {/* Global Root-Level Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notificationsList}
        onRefresh={handleRefreshNotifications}
        onNavigate={handleNavigate}
      />
    </>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <AppDataProvider>
        <MainApp />
      </AppDataProvider>
    </DialogProvider>
  );
}
