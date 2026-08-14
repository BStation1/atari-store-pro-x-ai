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
  Search,
  X,
  User as UserIcon,
  Smartphone,
  Sparkles,
  PieChart,
  ShieldCheck,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { db } from "./lib/data";
import { authStore } from "./lib/authStore";
import { authSupabase as supabase } from "./lib/authSupabaseClient";
import { hasPermission, getViewRequiredPermission } from "./lib/authPermissions";
import { useCurrentUser, useSettings } from "./hooks/useData";
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

const AUTH_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms);
    })
  ]);
}

function MainApp() {
  useEffect(() => {
    db.init();
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const queryView = urlParams.get("view");
      const trackId = urlParams.get("id") || urlParams.get("orderId") || urlParams.get("track") || urlParams.get("token") || urlParams.get("phone");
      if (pathname.includes("/login")) setCurrentView("login");
      else if (pathname.includes("/unauthorized")) setCurrentView("unauthorized");
      else if (queryView === "tracking" || trackId || pathname.includes("/track")) {
        setCurrentView("tracking");
        if (trackId) setNavigationParams({ initialQuery: trackId });
      }
    }
  }, []);

  const { user: currentLoggedUser } = useCurrentUser();
  const { settings } = useSettings();
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [postLoginRedirect, setPostLoginRedirect] = useState<string>("dashboard");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState("");
  const [notificationsTick, setNotificationsTick] = useState(0);
  const [hasOwner, setHasOwner] = useState<boolean>(true);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [hasSupabaseSession, setHasSupabaseSession] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleRefreshNotifications = () => setNotificationsTick(prev => prev + 1);
  const notificationsList = React.useMemo(() => db.getNotifications() || [], [notificationsTick]);
  const totalNotifications = notificationsList.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleDbChange = () => setNotificationsTick(prev => prev + 1);
    window.addEventListener("atari_db_changed", handleDbChange);
    return () => window.removeEventListener("atari_db_changed", handleDbChange);
  }, []);

  const handleNavigate = (view: string, params: any = null) => {
    const isPublic = view === "tracking" || view === "login" || view === "setup" || view === "unauthorized";
    if (!isPublic && (!hasSupabaseSession || !currentLoggedUser)) {
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

  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); handleNavigate("reception"); }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); handleNavigate("settings"); }
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); setIsSearchOpen(prev => !prev); }
    };
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [hasSupabaseSession, currentLoggedUser]);

  const handleLogout = async () => {
    await authStore.logout();
    setHasSupabaseSession(false);
    setIsUserMenuOpen(false);
    setIsProfileModalOpen(false);
    setCurrentView("login");
  };

  const handleLogoutAllDevices = () => {
    if (currentLoggedUser) authStore.logoutAllSessions(currentLoggedUser.id);
    handleLogout();
  };

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

  const allowedMenuItems = allMenuItems.filter(item => {
    if (item.id === "tracking") return true;
    if (!currentLoggedUser) return false;
    const reqPerm = getViewRequiredPermission(item.id);
    return !reqPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, reqPerm);
  });

  const directOwnerCheck = async (): Promise<boolean> => {
    const rpcResult = await withTimeout(Promise.resolve(supabase.rpc("has_owner")), 5000);
    if (rpcResult.error) throw rpcResult.error;
    return Boolean(rpcResult.data);
  };

  const checkAuthAndOwner = async () => {
    setIsAuthChecking(true);
    setAuthError(null);
    try {
      const sessionRes = await withTimeout(authStore.validateAndSyncSession());
      if (sessionRes.error) {
        setHasSupabaseSession(false);
        const ownerExists = await directOwnerCheck();
        setHasOwner(ownerExists);
        if (!ownerExists) setCurrentView("setup");
        else setAuthError(sessionRes.error);
        return;
      }

      if (!sessionRes.user) {
        setHasSupabaseSession(false);
        const ownerExists = await directOwnerCheck();
        setHasOwner(ownerExists);
        if (!ownerExists) setCurrentView("setup");
      } else {
        setHasSupabaseSession(true);
        setHasOwner(true);
      }
    } catch (err: any) {
      console.warn("⚠️ Error verifying auth and owner:", err);
      setHasSupabaseSession(false);
      try {
        const ownerExists = await directOwnerCheck();
        setHasOwner(ownerExists);
        if (!ownerExists) {
          setCurrentView("setup");
          setAuthError(null);
        } else {
          setCurrentView("login");
          setAuthError(err?.message === "AUTH_TIMEOUT" ? null : (err?.message || "حدث خطأ أثناء الاتصال بخادم المصادقة."));
        }
      } catch (ownerErr: any) {
        setCurrentView("login");
        setAuthError(ownerErr?.message || "تعذر الاتصال بخادم المستخدمين.");
      }
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    void checkAuthAndOwner();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT" || !session) {
        setHasSupabaseSession(false);
        void directOwnerCheck().then(ownerExists => {
          if (!isMounted) return;
          setHasOwner(ownerExists);
          setCurrentView(ownerExists ? "login" : "setup");
        }).catch(() => {
          if (isMounted) setCurrentView("login");
        });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void checkAuthAndOwner();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (currentView === "tracking") return <TrackingPage initialQuery={navigationParams?.initialQuery} />;

  if (isAuthChecking) {
    return <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl"><div className="text-center space-y-4"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div><p className="text-xs text-gray-400 font-bold">جاري التحقق من جلسة الدخول وصلاحيات النظام...</p></div></div>;
  }

  if (authError) {
    return <div className="min-h-screen bg-[#070913] text-gray-100 flex items-center justify-center p-4 font-sans dir-rtl"><div className="bg-[#11131e] border border-red-500/30 p-6 max-w-md w-full rounded-3xl shadow-2xl text-center space-y-4"><AlertCircle className="w-6 h-6 text-red-400 mx-auto"/><h2 className="text-base font-bold text-white">خطأ في التحقق من المصادقة</h2><p className="text-xs text-red-300 leading-relaxed">{authError}</p><button onClick={checkAuthAndOwner} className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4"/>إعادة المحاولة</button></div></div>;
  }

  if (currentView === "setup" || !hasOwner) {
    return <InitialSetup onSuccess={() => { setHasOwner(true); setHasSupabaseSession(true); setCurrentView("dashboard"); }} onCancel={() => setCurrentView("login")} />;
  }

  if (!hasSupabaseSession || !currentLoggedUser || currentView === "login") {
    return <Login onSuccess={() => { setHasSupabaseSession(true); setCurrentView(postLoginRedirect || "dashboard"); }} onNavigateToSetup={() => setCurrentView("setup")} />;
  }

  const requiredPerm = getViewRequiredPermission(currentView);
  const isAuthorized = !requiredPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, requiredPerm);

  const renderViewContent = () => {
    if (!isAuthorized) return <Unauthorized requiredPermission={requiredPerm} onReturnHome={() => setCurrentView("dashboard")} />;
    switch (currentView) {
      case "dashboard": return <Dashboard onNavigate={handleNavigate} />;
      case "reception": return <Reception prefillData={navigationParams?.prefillData} onNavigate={handleNavigate} />;
      case "customers": return <CustomersList initialOpenAddModal={navigationParams?.openAddModal} initialFocusSearch={navigationParams?.focusSearch} />;
      case "repair-center": return <RepairCenter initialStatusFilter={navigationParams?.status} initialOrderId={navigationParams?.orderId} />;
      case "ai-diagnostics": return <AIDiagnostics onNavigateToReception={prefillData => handleNavigate("reception", { prefillData })} />;
      case "inventory": return <Inventory initialSearch={navigationParams?.search} />;
      case "accounting": return <Accounting openInvoiceModal={navigationParams?.openInvoiceModal} />;
      case "partner-accounting": return <PartnerDashboard currentUserId={currentLoggedUser.id} />;
      case "reports": return <Reports />;
      case "system-health": return <SystemHealthDashboard />;
      case "users": return <UsersList />;
      case "settings": return <SettingsView />;
      case "unauthorized": return <Unauthorized onReturnHome={() => setCurrentView("dashboard")} />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const commandSearchResults = cmdSearchQuery.trim() ? allowedMenuItems.filter(item => item.label.includes(cmdSearchQuery)) : allowedMenuItems;

  return <>
    {currentLoggedUser.mustChangePassword && <ForcePasswordChangeModal userId={currentLoggedUser.id} onSuccess={() => window.dispatchEvent(new Event("atari_auth_changed"))} />}
    <UserProfileModal user={currentLoggedUser} isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onLogoutAllDevices={handleLogoutAllDevices} />
    {isSearchOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-lg p-4"><button onClick={() => setIsSearchOpen(false)}><X/></button><input autoFocus value={cmdSearchQuery} onChange={e=>setCmdSearchQuery(e.target.value)} className="w-full bg-gray-950 p-3 text-white"/><div>{commandSearchResults.map(item=><button key={item.id} onClick={()=>handleNavigate(item.id)} className="w-full p-3 text-right text-white"><item.icon className="inline w-4 h-4"/> {item.label}</button>)}</div></div></div>}
    <AppShell settings={settings} currentUser={currentLoggedUser} currentView={currentView} menuItems={allowedMenuItems} totalNotifications={totalNotifications} isNotificationsOpen={isNotificationsOpen} setIsNotificationsOpen={setIsNotificationsOpen} isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onNavigate={handleNavigate} onLogout={handleLogout} onOpenProfile={() => setIsProfileModalOpen(true)} onOpenSearch={() => setIsSearchOpen(true)}>
      {renderViewContent()}
    </AppShell>
    <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} notifications={notificationsList} onRefresh={handleRefreshNotifications} onNavigate={handleNavigate} />
  </>;
}

export default function App() {
  return <DialogProvider><MainApp /></DialogProvider>;
}
