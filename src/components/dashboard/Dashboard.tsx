import React, { useMemo, useState, useEffect } from 'react';
import {
  HeartHandshake,
  Mic,
  Calendar,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
  Sparkles,
  Vault,
  Lightbulb,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { useLanguage } from '../../contexts/LanguageContext';
import { getUsageTipsEnabled } from '../../services/notifications';

interface DashboardProps {
  onNavigate: (tab: string, subView?: string) => void;
  onOpenNewPrayer: () => void;
  onOpenNewParole: () => void;
  onOpenShareModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenNewPrayer,
  onOpenNewParole,
  onOpenShareModal,
}) => {
  const { lang, t } = useLanguage();
  const isEn = lang === 'en';

  const {
    userProfile,
    prayers,
    testimonies,
    calendarActivities,
    recordings,
    weeklyAltarDays,
  } = useShalomDB();

  const [showTips, setShowTips] = useState<boolean>(() => getUsageTipsEnabled());

  useEffect(() => {
    const syncTips = () => setShowTips(getUsageTipsEnabled());
    window.addEventListener('shalom-settings-updated', syncTips);
    return () => window.removeEventListener('shalom-settings-updated', syncTips);
  }, []);

  const todayIso = new Date().toISOString().split('T')[0];
  const todayDow = new Date().getDay();
  const todaysAltar = useMemo(
    () => weeklyAltarDays.find((d) => d.dayOfWeek === todayDow) || null,
    [weeklyAltarDays, todayDow]
  );

  const todayFormatted = new Intl.DateTimeFormat(isEn ? 'en-US' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const activePrayersCount = prayers.filter(
    (p) =>
      p.status === 'nouvelle' ||
      p.status === 'en_priere' ||
      p.status === 'en_evolution' ||
      p.status === 'en_attente'
  ).length;
  const answeredPrayersCount = prayers.filter((p) => p.status === 'exaucee').length;

  const upcomingActivities = useMemo(() => {
    const items: Array<{ id: string; title: string; date: string; time: string }> = [];

    calendarActivities.forEach((c) => {
      if (c.status !== 'accompli' && c.date >= todayIso) {
        items.push({ id: c.id, title: c.title, date: c.date, time: c.time });
      }
    });

    prayers.forEach((p) => {
      if (
        p.nextFollowUpDate &&
        p.nextFollowUpDate >= todayIso &&
        p.status !== 'exaucee' &&
        p.status !== 'archivee'
      ) {
        items.push({
          id: `pr_${p.id}`,
          title: `${isEn ? 'Prayer reminder:' : 'Rappel prière :'} ${p.title}`,
          date: p.nextFollowUpDate,
          time: isEn ? 'Reminder' : 'Rappel',
        });
      }
    });

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarActivities, prayers, todayIso, isEn]);

  const hasCustomVerse = Boolean(userProfile?.dashboardVerseText?.trim());
  const verseText = hasCustomVerse
    ? userProfile!.dashboardVerseText!.trim()
    : isEn
      ? '“Peace I leave with you, My peace I give to you; not as the world gives do I give to you. Let not your heart be troubled, neither let it be afraid.”'
      : '« Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne s’alarme point. »';
  const verseRef = hasCustomVerse
    ? userProfile?.dashboardVerseRef?.trim() || ''
    : isEn
      ? 'John 14:27'
      : 'Jean 14:27';
  const displayName = userProfile?.fullName?.trim() || 'Utilisateur';

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-200">
      {/* Personal Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f42] via-[#102b5c] to-[#173c7a] text-white p-5 sm:p-8 shadow-lg border border-blue-900/50">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-amber-300/70 bg-white/15 flex items-center justify-center text-lg font-extrabold text-amber-200 shrink-0 shadow-md">
              {userProfile?.avatarDataUrl ? (
                <img
                  src={userProfile.avatarDataUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-300 capitalize">
                {todayFormatted}
              </div>
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white font-display leading-tight">
                {t('dashboard.peace')}, {displayName}
              </h2>
            </div>
          </div>

          <div className="mt-3 p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 text-slate-100 text-xs sm:text-sm leading-relaxed">
            <p className="italic font-serif whitespace-pre-line">{verseText}</p>
            {verseRef && (
              <p className="text-right text-[11px] font-semibold text-amber-300 mt-1">
                — {verseRef}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenNewPrayer}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{t('dashboard.newPrayer')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewParole}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{t('dashboard.recordParole')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenShareModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('dashboard.share')}</span>
            </button>
          </div>
        </div>

        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
      </div>

      {/* Ma prière du jour (Mon Autel) */}
      {todaysAltar && (
        <div
          onClick={() => onNavigate('altar')}
          className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300/70 dark:border-amber-800/60 hover:border-amber-500 transition cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Flame className="w-3.5 h-3.5" />
              <span>{isEn ? 'My Prayer Today · My Altar' : 'Ma prière du jour · Mon Autel'}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {todaysAltar.prayerTitle}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
              {todaysAltar.prayerFocus}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />
        </div>
      )}

      {/* 4 Simple Personal KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('prayers')}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.activePrayers')}</span>
            <HeartHandshake className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {activePrayersCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            +{answeredPrayersCount} {isEn ? 'answered' : `exaucée${answeredPrayersCount > 1 ? 's' : ''}`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('prayers', 'testimonies')}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500 transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.testimonies')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {testimonies.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isEn ? 'Thanksgiving' : 'Actions de grâces'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('parole')}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-500 transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.recordedParoles')}</span>
            <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {recordings.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isEn ? 'Local Audio & Video' : 'Audio & Vidéo locaux'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('calendar')}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.upcomingEvents')}</span>
            <Calendar className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {upcomingActivities.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isEn ? 'Personal calendar' : 'Agenda personnel'}
          </p>
        </button>
      </div>

      {/* Quick Spiritual Modules Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            id: 'altar',
            title: t('nav.altar'),
            sub: isEn ? 'Weekly altar & vows' : 'Autel & engagements',
            icon: Flame,
          },
          {
            id: 'journey',
            title: t('nav.journey'),
            sub: isEn ? 'Habits & programs' : 'Habitudes & progrès',
            icon: TrendingUp,
          },
          {
            id: 'studios',
            title: t('nav.studios'),
            sub: isEn ? 'Design, Audio & Video' : 'Visuel, Audio & Vidéo',
            icon: Sparkles,
          },
          {
            id: 'vault',
            title: t('nav.vault'),
            sub: isEn ? 'Books & documents' : 'Livres & documents',
            icon: Vault,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 transition flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {card.title}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{card.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Two clean sections: Recent Prayers & Upcoming Spiritual Moments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Mes Dernières Prières
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('prayers')}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Tout voir</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {prayers.slice(0, 3).map((prayer) => (
              <div
                key={prayer.id}
                onClick={() => onNavigate('prayers')}
                className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 transition cursor-pointer flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">{prayer.title}</span>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        prayer.status === 'exaucee'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {prayer.status === 'exaucee' ? 'Exaucée' : 'En prière'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                    {prayer.description}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {prayer.createdAt.split('T')[0]}
                </span>
              </div>
            ))}

            {prayers.length === 0 && (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800">
                <p className="text-xs text-slate-500">Aucune prière enregistrée pour le moment.</p>
              </div>
            )}
          </div>

          {recordings.length > 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Dernière parole enregistrée
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {recordings[0].title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {recordings[0].speaker} · {recordings[0].date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('parole')}
                className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shrink-0"
              >
                Écouter
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white px-1">
            Prochains Rendez-vous
          </h3>
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
            {upcomingActivities.slice(0, 4).map((act) => (
              <div
                key={act.id}
                className="text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5 last:border-0 last:pb-0"
              >
                <div className="font-bold text-slate-900 dark:text-white">{act.title}</div>
                <div className="text-slate-500 tabular-nums mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {act.date} · {act.time}
                  </span>
                </div>
              </div>
            ))}
            {upcomingActivities.length === 0 && (
              <p className="text-xs text-slate-500">Aucun rendez-vous planifié.</p>
            )}
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="w-full pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline text-left"
            >
              Ouvrir mon calendrier →
            </button>
          </div>
        </div>
      </div>

      {showTips && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-900 dark:text-white block">
              {isEn ? 'SHALOM Usage Tip' : 'Conseil d’utilisation'}
            </span>
            {isEn
              ? 'All your prayers, audio/video words, books, and creations stay stored 100% locally on your device. You can back them up or configure daily prayer reminders in Settings.'
              : 'Toutes vos prières, paroles audio/vidéo, livres et créations restent enregistrés sur votre appareil même hors connexion. Activez vos rappels quotidiens ou exportez une sauvegarde JSON depuis les Paramètres.'}
          </div>
        </div>
      )}
    </div>
  );
};
