import React from 'react';
import {
  Undo2,
  Redo2,
  Save,
  Download,
  Share2,
  Eye,
  X,
  FolderOpen,
  SlidersHorizontal,
} from 'lucide-react';

export interface StudioToolRailItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface StudioWorkspaceShellProps {
  projectTitle: string;
  onProjectTitleChange: (next: string) => void;
  titlePlaceholder?: string;
  statusLine?: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview?: () => void;
  onSaveProject: () => void;
  isSavingProject?: boolean;
  onOpenShalomFolder?: () => void;
  onShare?: () => void;
  exportMenu?: React.ReactNode;
  onPrimaryExport?: () => void;
  primaryExportLabel?: string;
  isExporting?: boolean;
  toolItems: StudioToolRailItem[];
  activeToolId: string | null;
  onSelectTool: (id: string | null) => void;
  toolDrawerTitle?: string;
  toolDrawerContent?: React.ReactNode;
  selectionToolbar?: React.ReactNode;
  centerStage: React.ReactNode;
  bottomBar?: React.ReactNode;
  inspectorTitle?: string;
  inspectorContent?: React.ReactNode;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  extraTopActions?: React.ReactNode;
}

export const StudioWorkspaceShell: React.FC<StudioWorkspaceShellProps> = ({
  projectTitle,
  onProjectTitleChange,
  titlePlaceholder = 'Projet sans titre',
  statusLine,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onSaveProject,
  isSavingProject = false,
  onOpenShalomFolder,
  onShare,
  exportMenu,
  onPrimaryExport,
  primaryExportLabel = 'Exporter',
  isExporting = false,
  toolItems,
  activeToolId,
  onSelectTool,
  toolDrawerTitle,
  toolDrawerContent,
  selectionToolbar,
  centerStage,
  bottomBar,
  inspectorTitle,
  inspectorContent,
  isInspectorOpen = false,
  onToggleInspector,
  extraTopActions,
}) => {
  const activeTool = toolItems.find((t) => t.id === activeToolId) || null;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] shadow-sm overflow-hidden">
      {/* 1. COMPACT TOP PROJECT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-3 py-2 bg-slate-50/90 dark:bg-[#0c1631] border-b border-slate-200 dark:border-slate-800">
        {/* Left: Editable title + status + undo/redo */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <div className="min-w-[110px] flex-1 max-w-[240px] sm:max-w-[300px]">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onProjectTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              aria-label="Nom du projet"
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-white dark:bg-[#081024] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 truncate"
            />
            {statusLine && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 px-0.5">
                {statusLine}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Annuler (Ctrl+Z)"
              aria-label="Annuler"
              className="min-w-[44px] min-h-[44px] lg:min-w-[36px] lg:min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#081024] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 transition"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Rétablir (Ctrl+Y)"
              aria-label="Rétablir"
              className="min-w-[44px] min-h-[44px] lg:min-w-[36px] lg:min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#081024] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 transition"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Workspace actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {extraTopActions}

          {onToggleInspector && inspectorContent && (
            <button
              type="button"
              onClick={onToggleInspector}
              className={`min-h-[44px] lg:min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition whitespace-nowrap ${
                isInspectorOpen
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white dark:bg-[#081024] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{inspectorTitle || 'Propriétés'}</span>
            </button>
          )}

          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              title="Aperçu plein écran"
              className="min-h-[44px] lg:min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#081024] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aperçu</span>
            </button>
          )}

          {onOpenShalomFolder && (
            <button
              type="button"
              onClick={onOpenShalomFolder}
              title="Ouvrir DOSSIER SHALOM"
              className="min-h-[44px] lg:min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#081024] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold hidden md:flex items-center gap-1.5 whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Dossier</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSaveProject}
            disabled={isSavingProject}
            className="min-h-[44px] lg:min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingProject ? '...' : 'Enregistrer'}</span>
          </button>

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="min-h-[44px] lg:min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Partager</span>
            </button>
          )}

          {exportMenu
            ? exportMenu
            : onPrimaryExport && (
                <button
                  type="button"
                  onClick={onPrimaryExport}
                  disabled={isExporting}
                  className="min-h-[44px] lg:min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Export...' : primaryExportLabel}</span>
                </button>
              )}
        </div>
      </div>

      {/* 2. MAIN WORKSPACE AREA */}
      <div className="flex flex-1 min-h-[340px] sm:min-h-[460px] lg:min-h-[650px] relative">
        {/* Desktop Left Vertical Tool Rail */}
        <aside className="hidden lg:flex flex-col w-[76px] shrink-0 bg-slate-50 dark:bg-[#0a1329] border-r border-slate-200 dark:border-slate-800 py-2 px-1.5 gap-1 overflow-y-auto">
          {toolItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeToolId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTool(isActive ? null : item.id)}
                className={`relative w-full min-h-[54px] px-1 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="leading-tight text-center line-clamp-1 max-w-full">
                  {item.label}
                </span>
                {item.badge !== undefined && Number(item.badge) > 0 && (
                  <span
                    className={`absolute top-1 right-1 text-[9px] font-bold px-1 rounded-full ${
                      isActive
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Desktop Collapsible Tool Drawer */}
        {activeTool && toolDrawerContent && (
          <aside className="hidden lg:flex flex-col w-[320px] xl:w-[348px] shrink-0 bg-white dark:bg-[#0c1631] border-r border-slate-200 dark:border-slate-800 max-h-[760px]">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {toolDrawerTitle || activeTool.label}
              </h3>
              <button
                type="button"
                onClick={() => onSelectTool(null)}
                aria-label="Fermer le panneau"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">{toolDrawerContent}</div>
          </aside>
        )}

        {/* Central Canvas / Stage + Contextual Selection Toolbar + Bottom Strip */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-100/80 dark:bg-[#050b19]">
          {selectionToolbar && (
            <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/95 dark:bg-[#0c1631]/95 border-b border-slate-200 dark:border-slate-800 flex flex-nowrap overflow-x-auto no-scrollbar lg:flex-wrap items-center gap-1.5 backdrop-blur-xs">
              {selectionToolbar}
            </div>
          )}

          <div className="flex-1 min-w-0 overflow-auto p-2 sm:p-4 flex flex-col items-center justify-center">
            {centerStage}
          </div>

          {bottomBar && (
            <div className="bg-white dark:bg-[#0c1631] border-t border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0">
              {bottomBar}
            </div>
          )}
        </div>

        {/* Desktop Right Properties Inspector (optional when active) */}
        {isInspectorOpen && inspectorContent && (
          <aside className="hidden lg:flex flex-col w-[290px] xl:w-[310px] shrink-0 bg-white dark:bg-[#0c1631] border-l border-slate-200 dark:border-slate-800 max-h-[760px]">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {inspectorTitle || 'Propriétés'}
              </h3>
              {onToggleInspector && (
                <button
                  type="button"
                  onClick={onToggleInspector}
                  aria-label="Fermer l’inspecteur"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">{inspectorContent}</div>
          </aside>
        )}
      </div>

      {/* 3. MOBILE THUMB-REACHABLE BOTTOM TOOL BAR (< lg) */}
      <div className="lg:hidden flex items-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-[#0c1631] border-t border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        {toolItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeToolId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTool(isActive ? null : item.id)}
              className={`min-h-[46px] min-w-[64px] px-2.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold shrink-0 transition whitespace-nowrap ${
                isActive
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-[#081024] border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {inspectorContent && onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`min-h-[46px] min-w-[64px] px-2.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold shrink-0 transition whitespace-nowrap ${
              isInspectorOpen
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-[#081024] border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Réglages</span>
          </button>
        )}
      </div>

      {/* 4. MOBILE SLIDE-UP BOTTOM-SHEET DRAWER FOR TOOLS OR INSPECTOR (< lg) */}
      {((activeTool && toolDrawerContent) || (isInspectorOpen && inspectorContent)) && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/50 backdrop-blur-[1px]">
          <div
            className="flex-1"
            onClick={() => {
              if (activeTool) onSelectTool(null);
              else if (isInspectorOpen && onToggleInspector) onToggleInspector();
            }}
          />
          <div className="bg-white dark:bg-[#0c1631] rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[78dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                {activeTool
                  ? toolDrawerTitle || activeTool.label
                  : inspectorTitle || 'Propriétés'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (activeTool) onSelectTool(null);
                  else if (onToggleInspector) onToggleInspector();
                }}
                aria-label="Fermer"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-3">
              {activeTool ? toolDrawerContent : inspectorContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
