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
  KeyRound,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { db } from "./lib/data";
import { authStore } from "./lib/authStore";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { hasPermission, getViewRequiredPermission, ROLE_LABELS_AR } from "./lib/authPermissions";
import { useCurrentUser, useSettings, useProducts, useRepairOrders } from "./hooks/useData";
import { fetchOrMigrateRepairOrders } from "./lib/supabaseRepairOrders";
import { fetchOrMigrateCustomers } from "./lib/supabaseCustomers";
import { fetchOrMigrateProducts } from "./lib/supabaseProducts";
import { fetchOrMigrateRepairPartUsages } from "./lib/supabasePartUsages";
import { fetchOrMigrateInvoices } from "./lib/supabaseInvoices";
import { fetchOrMigrateStoreSettings } from "./lib/supabaseSettings";

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
import AppShell from "./components/layout/AppShell";

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

  // Check if system has an owner & verify session from Supabase
  const [hasOwner, setHasOwner] = useState<boolean>(true); // Default to true so setup screen NEVER flashes accidentally
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuthAndOwner = async () => {
    setIsAuthChecking(true);
    setAuthError(null);

    try {
      if (!isSupabaseConfigured) {
        // If Supabase environment variables are missing, fallback to local operational mode without crash
        setHasOwner(true);
        setIsAuthChecking(false);
        return;
      }

      // 1. Verify Supabase Auth session first
      const sessionRes = await authStore.validateAndSyncSession();

      if (sessionRes.error) {
        const cleanErr = (sessionRes.error.includes('fetch') || sessionRes.error.includes('TypeError'))
          ? "تعذر الاتصال بقاعدة البيانات Supabase. يرجى التحقق من إعدادات VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY في Vercel ثم إعادة النشر (Redeploy)."
          : sessionRes.error;
        setAuthError(cleanErr);
        setIsAuthChecking(false);
        return;
      }

      // 2. If no user session exists, check if system has an owner in Supabase
      if (!sessionRes.user) {
        const ownerExists = await authStore.checkHasOwnerInSupabase();
        setHasOwner(ownerExists);
      } else {
        setHasOwner(true);
      }
    } catch (err: any) {
      console.warn("⚠️ Error verifying auth and owner in Supabase:", err);
      const raw = String(err?.message || err || '');
      if (raw.includes('fetch') || raw.includes('TypeError')) {
        setAuthError("تعذر الاتصال بقاعدة البيانات Supabase (TypeError: Failed to fetch). يرجى التأكد من ضبط VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY في إعدادات Vercel ثم إعادة النشر.");
      } else {
        setAuthError(err?.message || "حدث خطأ أثناء الاتصال بخادم المصادقة.");
      }
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    checkAuthAndOwner();

    const handleAuthChanged = () => {
      if (isMounted) {
        authStore.checkHasOwnerInSupabase().then(res => {
          if (isMounted) setHasOwner(res);
        });
      }
    };

    window.addEventListener("atari_auth_changed", handleAuthChanged);
    return () => {
      isMounted = false;
      window.removeEventListener("atari_auth_changed", handleAuthChanged);
    };
  }, []);

  // Initial Business Data Loading Gate
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [initialDataError, setInitialDataError] = useState<string | null>(null);
  const loadedUserIdRef = React.useRef<string | null>(null);
  const isInitialLoadInProgressRef = React.useRef<boolean>(false);

  const performInitialLoad = async (userId: string) => {
    if (isInitialLoadInProgressRef.current || loadedUserIdRef.current === userId) return;
    isInitialLoadInProgressRef.current = true;
    setIsInitialLoading(true);
    setInitialDataError(null);

    try {
      // 1. AUTH READY GATE: Resolve current session once before loading protected data
      if (isSupabaseConfigured) {
        await supabase.auth.getSession();
      }

      // 2. Fetch essential datasets concurrently
      const [ordersRes, custRes, prodRes, usagesRes, invRes] = await Promise.all([
        fetchOrMigrateRepairOrders(),
        fetchOrMigrateCustomers(),
        fetchOrMigrateProducts(),
        fetchOrMigrateRepairPartUsages(),
        fetchOrMigrateInvoices(),
        fetchOrMigrateStoreSettings()
      ]);

      const hasFatalError = (ordersRes && !ordersRes.success && ordersRes.error) ||
                            (custRes && !custRes.success && custRes.error) ||
                            (invRes && !invRes.success && invRes.error);

      if (hasFatalError && isSupabaseConfigured) {
        console.warn("⚠️ Initial data fetch encountered an error:", ordersRes?.error || custRes?.error || invRes?.error);
        setInitialDataError("تعذر تحميل بيانات النظام");
        setIsInitialLoading(false);
        isInitialLoadInProgressRef.current = false;
        return;
      }

      loadedUserIdRef.current = userId;
      window.dispatchEvent(new CustomEvent("atari_db_changed"));
      setIsInitialLoading(false);
    } catch (err: any) {
      console.error("❌ Exception during initial data load:", err);
      setInitialDataError("تعذر تحميل بيانات النظام");
      setIsInitialLoading(false);
    } finally {
      isInitialLoadInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (currentLoggedUser?.id) {
      if (loadedUserIdRef.current !== currentLoggedUser.id) {
        performInitialLoad(currentLoggedUser.id);
      }
    } else {
      loadedUserIdRef.current = null;
      isInitialLoadInProgressRef.current = false;
      setIsInitialLoading(false);
      setInitialDataError(null);
    }
  }, [currentLoggedUser?.id]);

  // If viewing public tracking page, render directly without login wrapper
  if (currentView === "tracking") {
    return <TrackingPage initialQuery={navigationParams?.initialQuery} />;
  }

  // Loading state while verifying session & owner status
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 font-bold">جاري التحقق من جلسة الدخول وصلاحيات النظام...</p>
        </div>
      </div>
    );
  }

  // Error state during session verification
  if (authError) {
    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="bg-[#11131e] border border-red-500/30 p-6 max-w-md w-full rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-base font-bold text-white">خطأ في التحقق من المصادقة</h2>
          <p className="text-xs text-red-300 leading-relaxed">{authError}</p>
          <button
            onClick={() => checkAuthAndOwner()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      </div>
    );
  }

  // If setup flow is requested or system has no owner in Supabase
  if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login")) {
    return (
      <InitialSetup
        onSuccess={() => {
          setHasOwner(true);
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

  // Initial Data Loading Screen
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 font-bold">جاري تحميل بيانات النظام واستزراع القواعد...</p>
        </div>
      </div>
    );
  }

  // Initial Data Error Screen
  if (initialDataError) {
    return (
      <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl">
        <div className="bg-[#11131e] border border-red-500/30 p-6 max-w-md w-full rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-base font-bold text-white font-sans">تعذر تحميل بيانات النظام</h2>
          <p className="text-xs text-red-300 leading-relaxed">{initialDataError}</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                loadedUserIdRef.current = null;
                if (currentLoggedUser) {
                  performInitialLoad(currentLoggedUser.id);
                }
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold py-3 px-4 rounded-xl text-xs transition-all border border-red-500/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
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
      <MainApp />
    </DialogProvider>
  );
}
