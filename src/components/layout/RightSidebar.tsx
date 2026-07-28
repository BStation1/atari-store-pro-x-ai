/**
 * RightSidebar Component (Phase 3UI.0 - Premium Design System)
 * Fixed RTL Sidebar positioned on the right side.
 * Supports Desktop Expanded, Desktop Collapsed (icons + tooltips), and Mobile Drawer modes.
 * @license Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Wrench,
  Users,
  Warehouse,
  DollarSign,
  TrendingUp,
  Settings,
  PlusCircle,
  Sparkles,
  PieChart,
  User as UserIcon,
  Smartphone,
  ShieldCheck,
  X,
  Gamepad2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface RightSidebarProps {
  allowedMenuItems: MenuItem[];
  currentView: string;
  onNavigate: (viewId: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  companyName?: string;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  allowedMenuItems,
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  companyName = 'Atari Store'
}) => {
  // Prevent body scrolling on mobile when drawer is open
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpenMobile]);

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Main Container */}
      <aside
        dir="rtl"
        className={`fixed inset-y-0 right-0 z-50 bg-[#0d0f19] border-l border-slate-800/80 flex flex-col justify-between transition-all duration-300 ease-in-out lg:static lg:h-screen shrink-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          isOpenMobile
            ? 'translate-x-0 w-72 shadow-2xl'
            : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
          {/* Logo & Header Section */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
            <div className={`flex items-center gap-3.5 overflow-hidden ${isCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 shrink-0 shadow-sm">
                <Gamepad2 className="w-7 h-7" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold text-white tracking-tight truncate font-sans">
                    {typeof companyName === 'string' ? companyName : String((companyName as any)?.companyName || (companyName as any)?.company_name || 'Atari Store')}
                  </h1>
                  <span className="text-[10px] font-mono text-indigo-400 block font-bold tracking-wider uppercase mt-0.5">
                    PRO X AI
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate">
                    PlayStation Repair Management
                  </span>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              aria-label="إغلاق القائمة"
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Items Loop grouped by Section */}
          <nav className="p-3.5 space-y-5 flex-1">
            {(() => {
              const menuSections = [
                {
                  id: 'dashboard',
                  title: 'الرئيسية',
                  itemIds: ['dashboard']
                },
                {
                  id: 'repair',
                  title: 'الصيانة',
                  itemIds: ['reception', 'repair-center', 'ai-diagnostics']
                },
                {
                  id: 'customers',
                  title: 'العملاء',
                  itemIds: ['customers']
                },
                {
                  id: 'inventory',
                  title: 'المخزون',
                  itemIds: ['inventory']
                },
                {
                  id: 'finance',
                  title: 'المالية والتقارير',
                  itemIds: ['accounting', 'partner-accounting', 'reports']
                },
                {
                  id: 'system',
                  title: 'النظام والأمان',
                  itemIds: ['system-health', 'users', 'tracking', 'settings']
                }
              ];

              // Handle any items not explicitly mapped
              const mappedIds = new Set(menuSections.flatMap(s => s.itemIds));
              const unmappedItems = allowedMenuItems.filter(item => !mappedIds.has(item.id));

              return (
                <>
                  {menuSections.map((section, idx) => {
                    const sectionItems = allowedMenuItems.filter(item => section.itemIds.includes(item.id));
                    if (sectionItems.length === 0) return null;

                    return (
                      <div key={section.id} className="space-y-1.5">
                        {!isCollapsed ? (
                          <div className={`text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-3 pb-1 ${idx > 0 ? 'pt-2.5 border-t border-slate-800/60' : ''}`}>
                            {section.title}
                          </div>
                        ) : idx > 0 ? (
                          <div className="border-t border-slate-800/60 my-2.5 mx-2" />
                        ) : null}

                        <div className="space-y-1">
                          {sectionItems.map((item) => {
                            const isSelected = currentView === item.id;
                            const Icon = item.icon;

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleItemClick(item.id)}
                                title={isCollapsed ? item.label : undefined}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer group focus-ring-custom ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-950/70 border border-indigo-400/40 translate-x-0.5'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 hover:translate-x-0.5'
                                } ${isCollapsed ? 'lg:justify-center lg:px-0 lg:hover:translate-x-0' : ''}`}
                              >
                                <Icon
                                  className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                    isSelected ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                                  }`}
                                />
                                {!isCollapsed && <span className="truncate">{item.label}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Render any unmapped items safely */}
                  {unmappedItems.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-800/50">
                      {!isCollapsed && (
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pb-1">
                          أخرى
                        </div>
                      )}
                      {unmappedItems.map((item) => {
                        const isSelected = currentView === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer group focus-ring-custom ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50 border border-indigo-400/30'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                            } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                                isSelected ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                              }`}
                            />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </div>

        {/* Desktop Collapse Toggle & Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            className="hidden lg:flex w-full items-center justify-center gap-2 p-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/60 transition cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4 text-indigo-400" />
            ) : (
              <>
                <ChevronRight className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-medium">طي القائمة الجانبية</span>
              </>
            )}
          </button>

          {!isCollapsed && (
            <div className="text-[10px] text-slate-500 font-mono text-center pt-1">
              Atari Store Pro X AI v2.0
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default RightSidebar;
