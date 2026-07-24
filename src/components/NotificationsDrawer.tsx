/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Bell,
  X,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Package,
  Wrench,
  DollarSign,
  User,
  ChevronLeft,
  Info
} from "lucide-react";
import { SystemNotification } from "../types";
import { db } from "../lib/db";

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  onRefresh: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

export default function NotificationsDrawer({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onNavigate
}: NotificationsDrawerProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filtered = notifications.filter(n => {
    if (filterCategory === "all") return true;
    if (filterCategory === "unread") return !n.isRead;
    return n.category === filterCategory;
  });

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.markNotificationAsRead(id);
    onRefresh();
  };

  const handleMarkAllRead = () => {
    db.markAllNotificationsAsRead();
    onRefresh();
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    db.markNotificationAsRead(notif.id);
    onRefresh();
    if (notif.linkView && onNavigate) {
      onNavigate(notif.linkView, notif.linkParams);
      onClose();
    }
  };

  const getCategoryIcon = (category: string, type: string) => {
    switch (category) {
      case "warranty":
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case "inventory":
        return <Package className="w-4 h-4 text-purple-400" />;
      case "repair":
        return <Wrench className="w-4 h-4 text-emerald-400" />;
      case "customer":
        return <User className="w-4 h-4 text-blue-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="absolute inset-y-0 right-0 max-w-full flex"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl h-full">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  مركز الإشعارات والتنبيهات
                </h3>
                <p className="text-xs text-slate-400">متابعة صيانة الأجهزة والضمانات والمخزون</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="إغلاق الإشعارات"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Filter Tabs */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                filterCategory === "all"
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilterCategory("unread")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                filterCategory === "unread"
                  ? "bg-rose-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              غير مقروء ({unreadCount})
            </button>
            <button
              onClick={() => setFilterCategory("warranty")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                filterCategory === "warranty"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🛡️ الضمان
            </button>
            <button
              onClick={() => setFilterCategory("repair")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                filterCategory === "repair"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🔧 الصيانة
            </button>
            <button
              onClick={() => setFilterCategory("inventory")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                filterCategory === "inventory"
                  ? "bg-purple-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              📦 المخزون
            </button>
          </div>

          {/* Actions bar */}
          {unreadCount > 0 && (
            <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/50 flex items-center justify-between text-xs">
              <span className="text-slate-400">تنشيط الإشعارات تلقائي</span>
              <button
                onClick={handleMarkAllRead}
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                تحديد الكل كمقروء
              </button>
            </div>
          )}

          {/* List of Notifications */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">لا توجد إشعارات بهذا الفلتر</p>
                <p className="text-xs opacity-70 mt-1">جميع المهام والتنبيهات محدثة بالكامل</p>
              </div>
            ) : (
              filtered.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer relative group ${
                    !notif.isRead
                      ? "bg-slate-800/90 border-indigo-500/40 shadow-lg shadow-indigo-500/5"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-80"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                      {getCategoryIcon(notif.category, notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-xs font-bold text-slate-100 truncate">
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-2">
                        <span>{new Date(notif.createdAt).toLocaleDateString("ar-EG")}</span>
                        <span className="text-indigo-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-[-2px] transition">
                          عرض التفاصيل <ChevronLeft className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
