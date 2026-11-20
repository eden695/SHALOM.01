import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface HorizontalScrollRailProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  wrapOnDesktop?: boolean;
  fadeClassName?: string;
}

export const HorizontalScrollRail: React.FC<HorizontalScrollRailProps> = ({
  children,
  className = '',
  innerClassName = '',
  wrapOnDesktop = false,
  fadeClassName = 'from-white via-white/85 dark:from-[#0c1631] dark:via-[#0c1631]/85',
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollRight(false);
      return;
    }
    const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
    setCanScrollRight(remaining > 8);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollerRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
    }
    window.addEventListener('resize', checkScroll);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, children]);

  const nudgeRight = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: 160, behavior: 'smooth' });
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={scrollerRef}
        onScroll={checkScroll}
        className={`flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth ${
          wrapOnDesktop ? 'lg:flex-wrap lg:overflow-visible' : ''
        } ${innerClassName}`}
      >
        {children}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={nudgeRight}
          aria-label="Faire défiler à droite"
          className={`absolute right-0 top-0 bottom-0 pl-5 pr-1 flex items-center justify-end bg-gradient-to-l to-transparent pointer-events-auto ${fadeClassName} ${
            wrapOnDesktop ? 'lg:hidden' : ''
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-200/90 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}
    </div>
  );
};
