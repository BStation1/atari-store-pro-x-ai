import fs from 'node:fs';

const path = 'src/App.tsx';
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error(`App keep-alive patch failed: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
`  const [currentView, setCurrentView] = useState<string>("dashboard");\n  const [navigationParams, setNavigationParams] = useState<any>(null);`,
`  const [currentView, setCurrentView] = useState<string>("dashboard");\n  const [navigationParams, setNavigationParams] = useState<any>(null);\n  // Keep every visited private workspace mounted so unsaved local UI state survives\n  // navigation between ERP sections. Only the active workspace is visible.\n  const [visitedViews, setVisitedViews] = useState<string[]>(["dashboard"]);\n  const [viewNavigationParams, setViewNavigationParams] = useState<Record<string, any>>({});`,
'visited view state'
);

replaceOnce(
`    setCurrentView(view);\n    setNavigationParams(params);`,
`    if (!isPublic) {\n      setVisitedViews(prev => prev.includes(view) ? prev : [...prev, view]);\n      if (params !== null && params !== undefined) {\n        setViewNavigationParams(prev => ({ ...prev, [view]: params }));\n      }\n    }\n    setCurrentView(view);\n    setNavigationParams(params);`,
'navigation keep-alive registration'
);

replaceOnce(
`  const requiredPerm = getViewRequiredPermission(currentView);\n  const isAuthorized = !requiredPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, requiredPerm);\n\n  const renderViewContent = () => {\n    if (!isAuthorized) return <Unauthorized requiredPermission={requiredPerm} onReturnHome={() => setCurrentView("dashboard")} />;\n    switch (currentView) {\n      case "dashboard": return <Dashboard onNavigate={handleNavigate} />;\n      case "reception": return <Reception prefillData={navigationParams?.prefillData} onNavigate={handleNavigate} />;\n      case "customers": return <CustomersList initialOpenAddModal={navigationParams?.openAddModal} initialFocusSearch={navigationParams?.focusSearch} />;\n      case "repair-center": return <RepairCenter initialStatusFilter={navigationParams?.status} initialOrderId={navigationParams?.orderId} />;\n      case "ai-diagnostics": return <AIDiagnostics onNavigateToReception={prefillData => handleNavigate("reception", { prefillData })} />;\n      case "inventory": return <Inventory initialSearch={navigationParams?.search} />;\n      case "accounting": return <Accounting openInvoiceModal={navigationParams?.openInvoiceModal} />;\n      case "partner-accounting": return <PartnerDashboard currentUserId={currentLoggedUser.id} />;\n      case "reports": return <Reports />;\n      case "system-health": return <SystemHealthDashboard />;\n      case "users": return <UsersList />;\n      case "settings": return <SettingsView />;\n      case "unauthorized": return <Unauthorized onReturnHome={() => setCurrentView("dashboard")} />;\n      default: return <Dashboard onNavigate={handleNavigate} />;\n    }\n  };`,
`  const renderViewContent = (view: string, params: any = null) => {\n    const requiredPerm = getViewRequiredPermission(view);\n    const isAuthorized = !requiredPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, requiredPerm);\n    if (!isAuthorized) return <Unauthorized requiredPermission={requiredPerm} onReturnHome={() => handleNavigate("dashboard")} />;\n    switch (view) {\n      case "dashboard": return <Dashboard onNavigate={handleNavigate} />;\n      case "reception": return <Reception prefillData={params?.prefillData} onNavigate={handleNavigate} />;\n      case "customers": return <CustomersList initialOpenAddModal={params?.openAddModal} initialFocusSearch={params?.focusSearch} />;\n      case "repair-center": return <RepairCenter initialStatusFilter={params?.status} initialOrderId={params?.orderId} />;\n      case "ai-diagnostics": return <AIDiagnostics onNavigateToReception={prefillData => handleNavigate("reception", { prefillData })} />;\n      case "inventory": return <Inventory initialSearch={params?.search} />;\n      case "accounting": return <Accounting openInvoiceModal={params?.openInvoiceModal} />;\n      case "partner-accounting": return <PartnerDashboard currentUserId={currentLoggedUser.id} />;\n      case "reports": return <Reports />;\n      case "system-health": return <SystemHealthDashboard />;\n      case "users": return <UsersList />;\n      case "settings": return <SettingsView />;\n      case "unauthorized": return <Unauthorized onReturnHome={() => handleNavigate("dashboard")} />;\n      default: return <Dashboard onNavigate={handleNavigate} />;\n    }\n  };\n\n  // Login redirects and deep links can land on a private view before handleNavigate\n  // has registered it. Include the active view defensively without remounting others.\n  const privateViewIds = new Set(allMenuItems.map(item => item.id).filter(id => id !== "tracking"));\n  const activePrivateViews = privateViewIds.has(currentView) && !visitedViews.includes(currentView)\n    ? [...visitedViews, currentView]\n    : visitedViews;`,
'view renderer accepts explicit view'
);

replaceOnce(
`    >\n      {renderViewContent()}\n    </AppShell>`,
`    >\n      {activePrivateViews\n        .filter(view => privateViewIds.has(view))\n        .map(view => {\n          const params = view === currentView\n            ? (viewNavigationParams[view] ?? navigationParams)\n            : viewNavigationParams[view];\n          return (\n            <div\n              key={view}\n              style={{ display: view === currentView ? "block" : "none" }}\n              aria-hidden={view === currentView ? undefined : true}\n              data-keep-alive-view={view}\n            >\n              {renderViewContent(view, params)}\n            </div>\n          );\n        })}\n    </AppShell>`,
'keep alive workspace rendering'
);

fs.writeFileSync(path, src);
console.log('✓ App workspace keep-alive navigation enabled');
