'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  Edit3,
  ScanLine,
  Camera,
  Globe,
  X,
  Command,
} from 'lucide-react';
import { CaptureModal } from './CaptureModal';
import { QuickCapture } from './CaptureModules/QuickCapture';
import { ScratchPad } from './CaptureModules/ScratchPad';
import { OCRTool } from './CaptureModules/OCRTool';
import { ScreenshotCapture } from './CaptureModules/ScreenshotCapture';
import { WebCapture } from './CaptureModules/WebCapture';
import { getAriaExpanded, getAriaHasPopup } from '@/lib/accessibility';

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

interface CaptureModule {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const captureModules: CaptureModule[] = [
  {
    id: 'quick',
    name: 'Quick Capture',
    icon: <FileText className="w-5 h-5" />,
    color: 'bg-indigo-500/80',
    description: 'Quick notes & ideas',
  },
  {
    id: 'scratchpad',
    name: 'Scratchpad',
    icon: <Edit3 className="w-5 h-5" />,
    color: 'bg-purple-500/80',
    description: 'Markdown editor',
  },
  {
    id: 'ocr',
    name: 'OCR',
    icon: <ScanLine className="w-5 h-5" />,
    color: 'bg-violet-500/80',
    description: 'Extract text from images',
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    icon: <Camera className="w-5 h-5" />,
    color: 'bg-amber-500/80',
    description: 'Capture screenshots',
  },
  {
    id: 'webpage',
    name: 'Web Capture',
    icon: <Globe className="w-5 h-5" />,
    color: 'bg-indigo-600/80',
    description: 'Save web pages',
  },
];

interface FloatingHubProps {
  onCaptureComplete?: () => void;
  activeModule?: string | null;
  onModuleChange?: (module: string | null) => void;
  onNavigateToItem?: (itemId: string) => void;
}

export function FloatingHub({
  onCaptureComplete,
  activeModule: externalActiveModule,
  onModuleChange,
  onNavigateToItem,
}: FloatingHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Use internal state only when external is not provided
  const [localActiveModule, setLocalActiveModule] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const fabRef = useRef<HTMLButtonElement>(null);
  const menuButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isMobile = useIsMobile();

  // Determine active module: use external if provided (controlled), otherwise use local (uncontrolled)
  const activeModule = externalActiveModule !== undefined ? externalActiveModule : localActiveModule;

  const setActiveModule = useCallback(
    (module: string | null) => {
      // Notify parent if callback provided
      onModuleChange?.(module);
      // Update local state if in uncontrolled mode
      if (externalActiveModule === undefined) {
        setLocalActiveModule(module);
      }
    },
    [externalActiveModule, onModuleChange]
  );

  const handleOpenModule = (moduleId: string) => {
    setActiveModule(moduleId);
    setIsOpen(false);
  };

  const handleCloseModule = useCallback(() => {
    setActiveModule(null);
  }, [setActiveModule]);

  const handleCaptureComplete = useCallback(() => {
    handleCloseModule();
    onCaptureComplete?.();
  }, [handleCloseModule, onCaptureComplete]);

  // Keyboard shortcut support
  // Note: Ctrl+K is handled by the global useKeyboardShortcuts hook in page.tsx
  // to avoid conflicts with the command palette and other global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        if (activeModule) {
          handleCloseModule();
        } else if (isOpen) {
          setIsOpen(false);
          setFocusedIndex(-1);
          fabRef.current?.focus();
        }
      }
      // Arrow key navigation when menu is open
      if (isOpen && !activeModule) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = (prev + 1) % captureModules.length;
            menuButtonRefs.current[next]?.focus();
            return next;
          });
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev <= 0 ? captureModules.length - 1 : prev - 1;
            menuButtonRefs.current[next]?.focus();
            return next;
          });
        }
        // Enter to activate focused module
        if (e.key === 'Enter' && focusedIndex >= 0) {
          e.preventDefault();
          handleOpenModule(captureModules[focusedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModule, handleCloseModule, isOpen, focusedIndex]);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'quick':
        return (
          <QuickCapture
            onComplete={handleCaptureComplete}
            onNavigateToItem={(itemId) => {
              handleCloseModule();
              onNavigateToItem?.(itemId);
            }}
          />
        );
      case 'scratchpad':
        return <ScratchPad onComplete={handleCaptureComplete} />;
      case 'ocr':
        return <OCRTool onComplete={handleCaptureComplete} />;
      case 'screenshot':
        return <ScreenshotCapture onComplete={handleCaptureComplete} />;
      case 'webpage':
        return <WebCapture onComplete={handleCaptureComplete} />;
      default:
        return null;
    }
  };

  const getModuleTitle = () => {
    const foundModule = captureModules.find((m) => m.id === activeModule);
    return foundModule?.name || '';
  };

  // Calculate radial menu positions (5 items arranged in a quartile arc above and left of the FAB)
  // Since the button is parked in the bottom right corner, we should fan out from -180 (far left) to -90 (directly above)
  const radialAngleStart = -180; // Start angle (left)
  const radialAngleEnd = -90;    // End angle (top)
  const radius = 100;            // Distance from FAB center (desktop)
  const mobileRadius = 75;       // Distance from FAB center (mobile)

  const getRadialPosition = (index: number, total: number, isMobile: boolean = false) => {
    const currentRadius = isMobile ? mobileRadius : radius;
    if (total === 1) return { x: 0, y: -currentRadius };
    const angleStep = (radialAngleEnd - radialAngleStart) / (total - 1);
    const angle = (radialAngleStart + angleStep * index) * (Math.PI / 180);
    return {
      x: Math.round(Math.cos(angle) * currentRadius),
      y: Math.round(Math.sin(angle) * currentRadius),
    };
  };

  return (
    <>
      {/* Floating Action Button - Positioned higher on mobile (bottom-28 = 112px) to avoid radial menu going off-screen */}
      {/* MobileBottomNav is 56px tall, radial radius is 70px, FAB is 56px tall */}
      {/* FAB center is at 112px - 28px = 84px from bottom */}
      {/* Top of radial menu is at 84px - 70px = 14px from bottom (safe, won't clip) */}
      <div className="fixed bottom-28 right-4 md:bottom-6 md:right-6 z-50">
        <motion.button
          ref={fabRef}
          aria-label="Create new capture"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="floating-button relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80 backdrop-blur-md text-white shadow-lg shadow-indigo-500/30 border border-white/20 flex items-center justify-center hover:shadow-xl hover:shadow-indigo-500/40 transition-shadow"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(!isOpen);
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Plus className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Pulse ring animation - only when FAB is closed to draw attention */}
        <AnimatePresence>
          {!isOpen && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full bg-indigo-400/20 pointer-events-none"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-purple-400/15 pointer-events-none"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: "easeOut" }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Keyboard shortcut hint */}
        <div className="absolute -top-8 right-0 flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>

        {/* Radial Menu - icons fan out from FAB center */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="menu"
              aria-label="Capture modules"
              aria-orientation="horizontal"
              className="absolute bottom-7 right-7 w-0 h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {captureModules.map((module, index) => {
                const position = getRadialPosition(index, captureModules.length, isMobile);
                return (
                  <motion.button
                    key={module.id}
                    ref={(el) => { menuButtonRefs.current[index] = el; }}
                    role="menuitem"
                    aria-label={module.name}
                    className={`absolute w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-shadow group backdrop-blur-md border border-white/20 ${module.color}`}
                    style={{
                      left: '50%',
                      top: '50%',
                      marginLeft: '-24px',
                      marginTop: '-24px',
                    }}
                    onClick={() => handleOpenModule(module.id)}
                    onFocus={() => setFocusedIndex(index)}
                    initial={{
                      x: 0,
                      y: 0,
                      scale: 0,
                      opacity: 0,
                    }}
                    animate={{
                      x: position.x,
                      y: position.y,
                      scale: 1,
                      opacity: 1,
                    }}
                    exit={{
                      x: 0,
                      y: 0,
                      scale: 0,
                      opacity: 0,
                      transition: {
                        delay: (captureModules.length - 1 - index) * 0.03,
                        type: 'spring',
                        stiffness: 400,
                        damping: 25,
                      },
                    }}
                    transition={{
                      delay: index * 0.06,
                      type: 'spring',
                      stiffness: 350,
                      damping: 22,
                      mass: 0.8,
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    tabIndex={isOpen ? 0 : -1}
                  >
                    {module.icon}
                    {/* Label - always visible when menu is expanded */}
                    <motion.span
                      className="absolute bottom-full mb-2 px-2 py-1 bg-popover/80 backdrop-blur-md text-popover-foreground text-xs font-medium rounded-md shadow-md border border-white/20 whitespace-nowrap pointer-events-none"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ delay: index * 0.06 + 0.15, duration: 0.2 }}
                    >
                      {module.name}
                    </motion.span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Module Dialogs using CaptureModal */}
      <CaptureModal
        open={activeModule !== null}
        onOpenChange={(open) => !open && handleCloseModule()}
        title={getModuleTitle()}
        showCloseButton={true}
      >
        {renderActiveModule()}
      </CaptureModal>
    </>
  );
}
