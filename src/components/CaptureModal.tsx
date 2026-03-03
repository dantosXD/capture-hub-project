'use client';

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

interface CaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

/**
 * CaptureModal - A reusable modal component for capture modules
 *
 * Features:
 * - Escape key to close (handled by Radix Dialog)
 * - Click outside to close (handled by Radix Dialog)
 * - X button to close (handled by Radix Dialog)
 * - Framer Motion animations for open/close
 * - Prevents background scroll when open (with nested modal support)
 * - Consistent styling across all capture modules
 */
export function CaptureModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  showCloseButton = true,
}: CaptureModalProps) {
  // Lock body scroll when modal is open (handles nested modals correctly)
  useBodyScrollLock(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar ${className || ''}`}
        showCloseButton={showCloseButton}
        onInteractOutside={(e) => {
          // Allow closing when clicking outside
          onOpenChange(false);
        }}
        onEscapeKeyDown={() => {
          // Allow closing on Escape key
          onOpenChange(false);
        }}
      >
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
              </DialogHeader>

              <div className="space-y-4">
                {children}
              </div>

              {footer && <DialogFooter>{footer}</DialogFooter>}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default CaptureModal;
