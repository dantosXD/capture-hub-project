/**
 * Shared Framer Motion animation variants for consistent,
 * subtle, and professional animations across the app.
 */

import type { Variants } from 'framer-motion';

// Default easing curves as tuples
const easeOut: [number, number, number, number] = [0.0, 0.0, 0.2, 1];
const easeInOut: [number, number, number, number] = [0.4, 0, 0.2, 1];

// --- Page / Section Fade-In ---
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease: easeOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: easeInOut },
  },
};

// --- Fade-in with subtle upward slide (great for page loads) ---
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: easeInOut },
  },
};

// --- Slide-in from left (list items) ---
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easeOut },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.2, ease: easeInOut },
  },
};

// --- Scale animation for cards on hover ---
export const scaleOnHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: easeOut } },
  tap: { scale: 0.98, transition: { duration: 0.1 } },
};

// --- Stagger children container ---
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// --- Stagger child item (used with staggerContainer) ---
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: easeInOut },
  },
};

// --- List item with slide + opacity (for inbox/list items) ---
export const listItem: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: easeOut },
  },
  exit: {
    opacity: 0,
    x: 20,
    height: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    transition: {
      opacity: { duration: 0.15 },
      x: { duration: 0.2 },
      height: { duration: 0.25, delay: 0.1 },
      marginBottom: { duration: 0.25, delay: 0.1 },
      paddingTop: { duration: 0.25, delay: 0.1 },
      paddingBottom: { duration: 0.25, delay: 0.1 },
    },
  },
};

// --- List stagger container with faster stagger for lists ---
export const listContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};
