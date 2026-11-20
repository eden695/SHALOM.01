import React from 'react';
import {
  Plus,
  Play,
  LayoutTemplate,
  FolderHeart,
  Archive,
  Sparkles,
  Layers,
  Clock,
  ArrowRight,
  Palette,
  Presentation,
  Film,
  Music,
} from 'lucide-react';
import { CreativeDesignItem } from '../../../types';
import { HorizontalScrollRail } from './HorizontalScrollRail';
import { TemplatePreviewCard, PreviewTemplateShape } from './TemplatePreviewCard';

export type StudioHomeKind = 'design' | 'presentation' | 'video' | 'audio';

export type StudioHomeTemplateCardItem = Omit<PreviewTemplateShape, 'isEn'>;

interface StudioHomeScreenProps {
  kind: StudioHomeKind;
  isEn: boolean;
  hasActiveWork: boolean;
  activeProjectTitle: string;
  activeSummary: string;
  onCreateBlank: () => void;
  onContinueWork: () => void;
  onOpenTemplatesTool: () => void;
  onOpenLibraryTool: () => void;
  libraryLabel: string;
  onOpenShalomResources: () => void;
  onOpenAllSaved: () => void;
  savedProjects: CreativeDesignItem[];
  savedPreviews?: Record<string, string>;
  onOpenSavedProject: (item: CreativeDesignItem) => void;
  featuredTemplates: StudioHomeTemplateCardItem[];
}

export const StudioHomeScreen: React.FC<StudioHomeScreenProps> = ({
  kind,
  isEn,
  hasActiveWork,
  activeProjectTitle,
  activeSummary,
  onCreateBlank,
  onContinueWork,
  onOpenTemplatesTool,
  onOpenLibraryTool,
  libraryLabel,
  onOpenShalomResources,
  onOpenAllSaved,
  savedProjects,
  savedPreviews,
  onOpenSavedProject,
  featuredTemplates,
}) => {
  const headerMeta: Record<
    StudioHomeKind,
    {
      title: string;
      subtitle: string;
      blankLabel: string;
      Icon: React.ComponentType<{ className?: string }>;
      accentBg: string;
    }
  > = {
    design: {
      title: isEn ? 'Graphic Studio' : 'Studio Création Graphique',
      subtitle: isEn
        ? 'Create posters, verse cards, invitations and church visuals.'
        : 'Créez des affiches, versets illustrés, invitations et visuels d’église.',
      blankLabel: isEn ? 'Blank Creation' : 'Nouveau projet vierge',
      Icon: Palette,
      accentBg: 'from-[#0b1f42] via-[#132f66] to-[#1d4ed8]',
    },
    presentation: {
      title: isEn ? 'Presentation Studio' : 'Studio Présentation 16:9',
      subtitle: isEn
        ? 'Build multi-slide decks for sermons, trainings and testimonies.'
        : 'Composez des diaporamas multipages pour prédications, études et assemblées.',
      blankLabel: isEn ? 'Blank Presentation' : 'Nouvelle présentation vierge',
      Icon: Presentation,
      accentBg: 'from-[#0b1f42] via-[#152e5c] to-[#0f766e]',
    },
    video: {
      title: isEn ? 'Video Studio' : 'Studio Montage Vidéo',
      subtitle: isEn
        ? 'Assemble scenes, animated verses, audio tracks and voiceovers.'
        : 'Montez vos scènes, versets animés, fonds sonores et voix-off hors ligne.',
      blankLabel: isEn ? 'Blank Video Project' : 'Nouveau montage vierge',
      Icon: Film,
      accentBg: 'from-[#0f172a] via-[#1e293b] to-[#1d4ed8]',
    },
    audio: {
      title: isEn ? 'Audio Studio' : 'Studio Audio Multipiste',
      subtitle: isEn
        ? 'Record voice, mix worship music, add EQ/reverb and export MP3/WAV.'
        : 'Enregistrez votre voix, mixez musiques et voix, et exportez en MP3 ou WAV.',
      blankLabel: isEn ? 'Blank Audio Project' : 'Nouveau projet audio vierge',
      Icon: Music,
      accentBg: 'from-[#09152e] via-[#16274d] to-[#9333ea]',
    },
  };

  const meta = headerMeta[kind];
  const Icon = meta.Icon;
  const recentProjects = savedProjects.slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] shadow-sm overflow-hidden">
      {/* Studio Welcome & Primary Actions */}
      <div className={`p-4 sm:p-6 bg-gradient-to-br ${meta.accentBg} text-white space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-extrabold tracking-tight font-display">
                {meta.title}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100/90 mt-0.5 leading-relaxed">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCreateBlank}
            className="min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{meta.blankLabel}</span>
          </button>
        </div>

        {/* Continue Current Work Banner */}
        {hasActiveWork && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{isEn ? 'Active draft in editor' : 'Projet en cours dans l’éditeur'}</span>
              </div>
              <div className="text-sm font-bold text-white truncate mt-0.5">
                {activeProjectTitle}
              </div>
              <div className="text-[11px] text-blue-100/80 truncate">{activeSummary}</div>
            </div>
            <button
              type="button"
              onClick={onContinueWork}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-blue-50 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isEn ? 'Continue editing' : 'Continuer l’édition'}</span>
            </button>
          </div>
        )}

        {/* Quick Horizontal Navigation Rail */}
        <HorizontalScrollRail
          wrapOnDesktop
          fadeClassName="from-[#142e61] via-[#142e61]/80"
        >
          <button
            type="button"
            onClick={onOpenTemplatesTool}
            className="shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-300" />
            <span>{isEn ? 'Browse Templates' : 'Modèles'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenLibraryTool}
            className="shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
          >
            <Layers className="w-3.5 h-3.5 text-sky-300" />
            <span>{libraryLabel}</span>
          </button>
          <button
            type="button"
            onClick={onOpenShalomResources}
            className="shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
          >
            <FolderHeart className="w-3.5 h-3.5 text-emerald-300" />
            <span>{isEn ? 'Offline SHALOM Resources' : 'Ressources SHALOM'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAllSaved}
            className="shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
          >
            <Archive className="w-3.5 h-3.5 text-amber-200" />
            <span>
              {isEn ? 'Saved Projects' : 'Mes projets'} ({savedProjects.length})
            </span>
          </button>
        </HorizontalScrollRail>
      </div>

      {/* Studio Home Body: Saved Projects + Featured Templates */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* Recent / Saved Projects */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isEn ? 'Recent Projects' : 'Projets récents & enregistrés'}</span>
            </h4>
            {savedProjects.length > 0 && (
              <button
                type="button"
                onClick={onOpenAllSaved}
                className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
              >
                <span>{isEn ? 'View all' : 'Tout voir'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                {isEn
                  ? 'No saved projects in this studio yet. Start from scratch or choose a template below.'
                  : 'Aucun projet enregistré dans ce studio pour le moment. Commencez un projet vierge ou choisissez un modèle ci-dessous.'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {recentProjects.map((proj) => {
                const thumb = savedPreviews?.[proj.id];
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onOpenSavedProject(proj)}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 hover:border-blue-600 text-left flex items-center gap-3 transition group"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={proj.title}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400">
                        {proj.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {proj.durationSeconds ? `${proj.durationSeconds}s · ` : ''}
                        {new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white text-[11px] font-bold shrink-0">
                      {isEn ? 'Open' : 'Ouvrir'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Featured Templates */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isEn ? 'Ready-to-Edit Templates' : 'Modèles prêts à personnaliser'}</span>
            </h4>
            <button
              type="button"
              onClick={onOpenTemplatesTool}
              className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
            >
              <span>{isEn ? 'Full gallery' : 'Tous les modèles'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {featuredTemplates.map((tpl) => (
              <TemplatePreviewCard key={tpl.id} {...tpl} isEn={isEn} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
