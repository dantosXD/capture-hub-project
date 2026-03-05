'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sparkles, ArrowRight, RefreshCw, AlignLeft, Expand,
    Briefcase, MessageCircle, Minus, Loader2, X, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const AI_ACTIONS: AIAction[] = [
    { id: 'continue', label: 'Continue', icon: <ArrowRight className="w-3.5 h-3.5" />, description: 'Continue writing' },
    { id: 'rewrite', label: 'Rewrite', icon: <RefreshCw className="w-3.5 h-3.5" />, description: 'Rewrite for clarity' },
    { id: 'summarize', label: 'Summarize', icon: <AlignLeft className="w-3.5 h-3.5" />, description: 'Summarize text' },
    { id: 'expand', label: 'Expand', icon: <Expand className="w-3.5 h-3.5" />, description: 'Add more detail' },
];

const TONE_OPTIONS: AIAction[] = [
    { id: 'tone_professional', label: 'Professional', icon: <Briefcase className="w-3.5 h-3.5" />, description: 'Formal tone' },
    { id: 'tone_casual', label: 'Casual', icon: <MessageCircle className="w-3.5 h-3.5" />, description: 'Conversational' },
    { id: 'tone_concise', label: 'Concise', icon: <Minus className="w-3.5 h-3.5" />, description: 'Brief & direct' },
];

interface AITextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onValueChange?: (value: string) => void;
    enableAI?: boolean;
}

export const AITextarea = React.forwardRef<HTMLTextAreaElement, AITextareaProps>(
    ({ onValueChange, enableAI = true, className, value, onChange, ...props }, ref) => {
        const internalRef = useRef<HTMLTextAreaElement>(null);
        const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
        const containerRef = useRef<HTMLDivElement>(null);

        const [showToolbar, setShowToolbar] = useState(false);
        const [showToneMenu, setShowToneMenu] = useState(false);
        const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
        const [isProcessing, setIsProcessing] = useState(false);
        const [processingAction, setProcessingAction] = useState<string | null>(null);
        const [hasSelection, setHasSelection] = useState(false);

        // Position toolbar near selection or cursor
        const updateToolbarPosition = useCallback(() => {
            const textarea = textareaRef.current;
            const container = containerRef.current;
            if (!textarea || !container) return;

            const textareaRect = textarea.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Position above the textarea, centered
            setToolbarPosition({
                top: textareaRect.top - containerRect.top - 48,
                left: Math.max(0, (textareaRect.width / 2) - 180),
            });
        }, [textareaRef]);

        // Show toolbar on text selection
        const handleSelect = useCallback(() => {
            if (!enableAI) return;
            const textarea = textareaRef.current;
            if (!textarea) return;

            const hasTextSelected = textarea.selectionStart !== textarea.selectionEnd;
            setHasSelection(hasTextSelected);

            if (hasTextSelected) {
                updateToolbarPosition();
                setShowToolbar(true);
            }
        }, [enableAI, updateToolbarPosition, textareaRef]);

        // Keyboard shortcut: Ctrl+Space to toggle toolbar
        const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                updateToolbarPosition();
                setShowToolbar(prev => !prev);
            }
            // Escape closes toolbar
            if (e.key === 'Escape' && showToolbar) {
                e.preventDefault();
                setShowToolbar(false);
                setShowToneMenu(false);
            }
        }, [showToolbar, updateToolbarPosition]);

        // Click outside closes toolbar
        useEffect(() => {
            const handleClickOutside = (e: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setShowToolbar(false);
                    setShowToneMenu(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        // Execute AI action
        const executeAction = async (actionId: string) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const fullText = textarea.value;
            const selStart = textarea.selectionStart;
            const selEnd = textarea.selectionEnd;
            const selectedText = fullText.substring(selStart, selEnd);

            setIsProcessing(true);
            setProcessingAction(actionId);

            try {
                const response = await fetch('/api/scratchpad/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: actionId,
                        text: fullText,
                        selectedText: selectedText || undefined,
                        context: selectedText ? fullText.substring(Math.max(0, selStart - 500), selStart) : undefined,
                    }),
                });

                if (!response.ok) {
                    throw new Error('AI request failed');
                }

                const data = await response.json();
                const result = data.result;

                if (!result) return;

                let newText: string;
                let newCursorPos: number;

                if (actionId === 'continue') {
                    // Insert at the end of selection/cursor
                    const insertPos = selEnd || fullText.length;
                    newText = fullText.substring(0, insertPos) + result + fullText.substring(insertPos);
                    newCursorPos = insertPos + result.length;
                } else if (selectedText) {
                    // Replace selection
                    newText = fullText.substring(0, selStart) + result + fullText.substring(selEnd);
                    newCursorPos = selStart + result.length;
                } else {
                    // Replace all text
                    newText = result;
                    newCursorPos = result.length;
                }

                // Update the textarea value
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                )?.set;
                nativeInputValueSetter?.call(textarea, newText);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Call value change callback
                onValueChange?.(newText);

                // Set cursor position
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
            } catch (error) {
                console.error('[AITextarea] Action failed:', error);
            } finally {
                setIsProcessing(false);
                setProcessingAction(null);
                setShowToolbar(false);
                setShowToneMenu(false);
            }
        };

        return (
            <div ref={containerRef} className="relative w-full">
                {/* AI Floating Toolbar */}
                {enableAI && showToolbar && (
                    <div
                        className="absolute z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
                        style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
                    >
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border bg-background/95 backdrop-blur-md shadow-xl shadow-black/10">
                            {/* Sparkle icon */}
                            <div className="flex items-center gap-1 pr-1 border-r mr-1">
                                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                <span className="text-xs font-medium text-purple-500">AI</span>
                            </div>

                            {/* Main actions */}
                            {AI_ACTIONS.map((action) => (
                                <Button
                                    key={action.id}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1.5 hover:bg-purple-500/10 hover:text-purple-600"
                                    onClick={() => executeAction(action.id)}
                                    disabled={isProcessing}
                                    title={action.description}
                                >
                                    {isProcessing && processingAction === action.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        action.icon
                                    )}
                                    {action.label}
                                </Button>
                            ))}

                            {/* Tone dropdown */}
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1 hover:bg-purple-500/10 hover:text-purple-600 border-l ml-1 pl-3 rounded-l-none"
                                    onClick={() => setShowToneMenu(!showToneMenu)}
                                    disabled={isProcessing}
                                >
                                    Tone <ChevronDown className="w-3 h-3" />
                                </Button>

                                {showToneMenu && (
                                    <div className="absolute top-full right-0 mt-1 min-w-[140px] rounded-lg border bg-background shadow-lg py-1 z-50 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                                        {TONE_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-purple-500/10 text-left transition-colors"
                                                onClick={() => executeAction(option.id)}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing && processingAction === option.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    option.icon
                                                )}
                                                <span>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Close button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground"
                                onClick={() => { setShowToolbar(false); setShowToneMenu(false); }}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Ctrl+Space hint */}
                {enableAI && !showToolbar && (
                    <div className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground/50 pointer-events-none select-none">
                        Ctrl+Space for AI
                    </div>
                )}

                {/* Actual textarea */}
                <textarea
                    ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                    value={value}
                    onChange={(e) => {
                        onChange?.(e);
                        onValueChange?.(e.target.value);
                    }}
                    onSelect={handleSelect}
                    onKeyDown={(e) => {
                        handleKeyDown(e);
                        props.onKeyDown?.(e);
                    }}
                    className={cn(
                        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'resize-none',
                        className
                    )}
                    {...props}
                />
            </div>
        );
    }
);

AITextarea.displayName = 'AITextarea';
