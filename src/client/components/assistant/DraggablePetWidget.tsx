'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { AssistantPanel } from '@client/components/assistant/AssistantPanel';
import {
  clampCoordinates,
  isDragMovement,
  type Coordinates,
} from '@client/components/assistant/draggable-pet-math';
import {
  transitionPetAnimation,
  type PetAnimation,
} from '@client/components/assistant/pet-animation';

export { clampCoordinates, isDragMovement };

const WIDGET_WIDTH = 76;
const WIDGET_HEIGHT = 84;
const LOCAL_STORAGE_KEY = 'clawd_pet_position';

export function DraggablePetWidget() {
  const pathname = usePathname();
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [animation, setAnimation] = useState<PetAnimation>('idle');
  const [showTooltip, setShowTooltip] = useState(true);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerSucceededRef = useRef(false);

  const handleLoadingChange = useCallback((loading: boolean) => {
    if (loading) {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      answerSucceededRef.current = false;
      setAnimation((current) => transitionPetAnimation(current, 'start'));
    } else if (!answerSucceededRef.current) {
      setAnimation((current) => transitionPetAnimation(current, 'failure'));
    }
  }, []);

  const handleAnswerSuccess = useCallback(() => {
    answerSucceededRef.current = true;
    setAnimation((current) => transitionPetAnimation(current, 'success'));
    finishTimerRef.current = setTimeout(() => {
      setAnimation((current) => transitionPetAnimation(current, 'timeout'));
      finishTimerRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
  }, []);

  const isDraggingRef = useRef(false);
  const startPointerRef = useRef<Coordinates>({ x: 0, y: 0 });
  const startPosRef = useRef<Coordinates>({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Initialize position from localStorage or default to bottom-right
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const frameId = requestAnimationFrame(() => {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      let initialPos: Coordinates;

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            initialPos = parsed;
          } else {
            initialPos = {
              x: window.innerWidth - WIDGET_WIDTH - 24,
              y: window.innerHeight - WIDGET_HEIGHT - 24,
            };
          }
        } catch {
          initialPos = {
            x: window.innerWidth - WIDGET_WIDTH - 24,
            y: window.innerHeight - WIDGET_HEIGHT - 24,
          };
        }
      } else {
        initialPos = {
          x: window.innerWidth - WIDGET_WIDTH - 24,
          y: window.innerHeight - WIDGET_HEIGHT - 24,
        };
      }

      const clamped = clampCoordinates(
        initialPos,
        { width: window.innerWidth, height: window.innerHeight },
        { width: WIDGET_WIDTH, height: WIDGET_HEIGHT }
      );
      setPosition(clamped);
    });

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        return clampCoordinates(
          prev,
          { width: window.innerWidth, height: window.innerHeight },
          { width: WIDGET_WIDTH, height: WIDGET_HEIGHT }
        );
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // Primary button only
    isDraggingRef.current = false;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = position || { x: 0, y: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const currentPointer = { x: e.clientX, y: e.clientY };

    if (!isDraggingRef.current) {
      if (isDragMovement(startPointerRef.current, currentPointer, 6)) {
        isDraggingRef.current = true;
        setShowTooltip(false);
      }
    }

    if (isDraggingRef.current && typeof window !== 'undefined') {
      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;
      const rawPos = {
        x: startPosRef.current.x + dx,
        y: startPosRef.current.y + dy,
      };
      const clamped = clampCoordinates(
        rawPos,
        { width: window.innerWidth, height: window.innerHeight },
        { width: WIDGET_WIDTH, height: WIDGET_HEIGHT }
      );
      setPosition(clamped);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!isDraggingRef.current) {
      // It was a click!
      setIsOpen((prev) => !prev);
      setShowTooltip(false);
    } else {
      // Finished dragging: persist new position
      if (position) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(position));
      }
    }
    isDraggingRef.current = false;
  }, [position]);

  // Hide on admin routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes clawd-idle-anim {
          from { background-position: 0px 0px; }
          to { background-position: -432px 0px; }
        }
        @keyframes clawd-cooking-anim {
          from { background-position: 0px -468px; }
          to { background-position: -432px -468px; }
        }
        @keyframes clawd-finished-anim {
          from { background-position: 0px -234px; }
          to { background-position: -288px -234px; }
        }
        .clawd-sprite-idle {
          width: 72px;
          height: 78px;
          background-image: url('/assets/pet/clawd-chef/spritesheet.webp');
          background-size: 576px 858px;
          animation: clawd-idle-anim 1s steps(6) infinite;
          image-rendering: pixelated;
        }
        .clawd-sprite-cooking {
          width: 72px;
          height: 78px;
          background-image: url('/assets/pet/clawd-chef/spritesheet.webp');
          background-size: 576px 858px;
          animation: clawd-cooking-anim 0.8s steps(6) infinite;
          image-rendering: pixelated;
        }
        .clawd-sprite-finished {
          width: 72px;
          height: 78px;
          background-image: url('/assets/pet/clawd-chef/spritesheet.webp');
          background-size: 576px 858px;
          animation: clawd-finished-anim 0.67s steps(4) infinite;
          image-rendering: pixelated;
        }
      `}</style>

      {/* Floating Draggable Mascot Button */}
      {position && (
        <div
          ref={widgetRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            touchAction: 'none',
          }}
          className="select-none cursor-grab active:cursor-grabbing flex flex-col items-center"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-label="Trợ lý AI Clawd Chef"
        >
          {/* Friendly Tooltip Bubble */}
          {showTooltip && !isOpen && (
            <div className="absolute -top-10 bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap animate-bounce pointer-events-none border border-slate-700/60">
              ✨ Cần tư vấn? Hỏi Clawd nhé!
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700/60" />
            </div>
          )}

          {/* Mascot Sprite Container */}
          <div className="relative group p-1 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-150">
            <div className={`clawd-sprite-${animation}`} />
            <span
              className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                animation === 'cooking' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
              }`}
              title={animation === 'cooking' ? 'Clawd đang nấu câu trả lời...' : 'Clawd Chef sẵn sàng hỗ trợ'}
            />
          </div>
        </div>
      )}

      {/* Chat Window Dialog / Drawer */}
      {isOpen && (
        <>
          {/* Mobile Overlay Backdrop */}
          <div
            className="sm:hidden fixed inset-0 bg-black/40 z-[99998] backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Desktop Floating Box & Mobile Bottom Sheet */}
          <div className="fixed z-[99999] inset-x-0 bottom-0 sm:inset-auto sm:right-6 sm:bottom-24 max-w-md w-full sm:w-[420px] p-2 sm:p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-neutral-900">
              <AssistantPanel
                onLoadingChange={handleLoadingChange}
                onAnswerSuccess={handleAnswerSuccess}
                onClose={() => setIsOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
export default DraggablePetWidget;
