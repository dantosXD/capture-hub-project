'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sparkles, ArrowRight, RefreshCw, AlignLeft, Expand,
    Briefcase, MessageCircle, Minus, Loader2, X, ChevronDown,
    ChevronLeft, Settings, Wand2, Pencil, Trash2, Plus,
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface AIAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    description: string;
}

export interface PromptTemplate {
    id: string;
    name: string;
    prompt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const AI_ACTIONS: AIAction[] = [
    { id: 'continue',  label: 'Continue',  icon: <ArrowRight className="w-3.5 h-3.5" />, description: 'Continue writing' },
    { id: 'rewrite',   label: 'Rewrite',   icon: <RefreshCw  className="w-3.5 h-3.5" />, description: 'Rewrite for clarity' },
    { id: 'summarize', label: 'Summarize', icon: <AlignLeft  className="w-3.5 h-3.5" />, description: 'Summarize text' },
    { id: 'expand',    label: 'Expand',    icon: <Expand     className="w-3.5 h-3.5" />, description: 'Add more detail' },
];

const TONE_OPTIONS: AIAction[] = [
    { id: 'tone_professional', label: 'Professional', icon: <Briefcase     className="w-3.5 h-3.5" />, description: 'Formal tone' },
    { id: 'tone_casual',       label: 'Casual',       icon: <MessageCircle className="w-3.5 h-3.5" />, description: 'Conversational' },
    { id: 'tone_concise',      label: 'Concise',      icon: <Minus         className="w-3.5 h-3.5" />, description: 'Brief & direct' },
];

const TEMPLATES_KEY = 'capture-hub:ai-prompt-templates';

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadTemplates(): PromptTemplate[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
    catch { return []; }
}

function persistTemplates(templates: PromptTemplate[]): void {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// ── Template Manager Dialog ───────────────────────────────────────────────────

interface TemplateManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templates: PromptTemplate[];
    onTemplatesChange: (templates: PromptTemplate[]) => void;
}

function TemplateManager({ open, onOpenChange, templates, onTemplatesChange }: TemplateManagerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formPrompt, setFormPrompt] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const startEdit = (t: PromptTemplate) => {
        setEditingId(t.id);
        setFormName(t.name);
        setFormPrompt(t.prompt);
        setIsAdding(false);
    };

    const startAdd = () => {
        setEditingId(null);
        setFormName('');
        setFormPrompt('');
        setIsAdding(true);
    };

    const cancelForm = () => {
        setEditingId(null);
        setIsAdding(false);
        setFormName('');
        setFormPrompt('');
    };

    const saveNew = () => {
        if (!formName.trim() || !formPrompt.trim()) return;
        const updated = [...templates, { id: crypto.randomUUID(), name: formName.trim(), prompt: formPrompt.trim() }];
        onTemplatesChange(updated);
        persistTemplates(updated);
        cancelForm();
    };

    const saveEdit = () => {
        if (!formName.trim() || !formPrompt.trim() || !editingId) return;
        const updated = templates.map(t =>
            t.id === editingId ? { ...t, name: formName.trim(), prompt: formPrompt.trim() } : t
        );
        onTemplatesChange(updated);
        persistTemplates(updated);
        cancelForm();
    };

    const deleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        onTemplatesChange(updated);
        persistTemplates(updated);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Prompt Templates</DialogTitle>
                    <DialogDescription>
                        Create reusable AI prompts that appear as quick-action buttons in the toolbar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {templates.length === 0 && !isAdding && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            No templates yet. Add one below.
                        </p>
                    )}

                    {templates.map(t => (
                        <div key={t.id} className="rounded-lg border">
                            {editingId === t.id ? (
                                <div className="p-3 space-y-2">
                                    <Input
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="Template name"
                                        className="h-8 text-sm"
                                    />
                                    <textarea
                                        value={formPrompt}
                                        onChange={e => setFormPrompt(e.target.value)}
                                        placeholder="Prompt text…"
                                        rows={3}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={saveEdit} disabled={!formName.trim() || !formPrompt.trim()}>
                                            Save
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={cancelForm}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between p-3 group">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{t.name}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.prompt}</p>
                                    </div>
                                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => startEdit(t)}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => deleteTemplate(t.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new form */}
                {isAdding ? (
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium">New Template</p>
                        <Input
                            autoFocus
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder="Name (e.g. Extract action items)"
                            className="h-8 text-sm"
                        />
                        <textarea
                            value={formPrompt}
                            onChange={e => setFormPrompt(e.target.value)}
                            placeholder="Prompt (e.g. Extract all action items as a bullet list)"
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={saveNew} disabled={!formName.trim() || !formPrompt.trim()}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelForm}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="pt-2 border-t">
                        <Button size="sm" variant="outline" onClick={startAdd}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Template
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── AITextarea ────────────────────────────────────────────────────────────────

interface AITextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onValueChange?: (value: string) => void;
    enableAI?: boolean;
}

export const AITextarea = React.forwardRef<HTMLTextAreaElement, AITextareaProps>(
    ({ onValueChange, enableAI = true, className, value, onChange, ...props }, ref) => {
        const internalRef = useRef<HTMLTextAreaElement>(null);
        const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
        const containerRef = useRef<HTMLDivElement>(null);
        const promptInputRef = useRef<HTMLInputElement>(null);

        const [showToolbar, setShowToolbar] = useState(false);
        const [showToneMenu, setShowToneMenu] = useState(false);
        const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
        const [isProcessing, setIsProcessing] = useState(false);
        const [processingAction, setProcessingAction] = useState<string | null>(null);

        // Prompt input mode
        const [showPromptInput, setShowPromptInput] = useState(false);
        const [customPromptText, setCustomPromptText] = useState('');

        // Templates
        const [templates, setTemplates] = useState<PromptTemplate[]>([]);
        const [showTemplateManager, setShowTemplateManager] = useState(false);

        // Load templates on mount
        useEffect(() => {
            setTemplates(loadTemplates());
        }, []);

        // Focus prompt input when it appears
        useEffect(() => {
            if (showPromptInput) {
                setTimeout(() => promptInputRef.current?.focus(), 50);
            }
        }, [showPromptInput]);

        // Position toolbar near selection or cursor
        const updateToolbarPosition = useCallback(() => {
            const textarea = textareaRef.current;
            const container = containerRef.current;
            if (!textarea || !container) return;

            const textareaRect = textarea.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

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
                setShowPromptInput(false);
            }
            if (e.key === 'Escape' && showToolbar) {
                e.preventDefault();
                setShowToolbar(false);
                setShowToneMenu(false);
                setShowPromptInput(false);
            }
        }, [showToolbar, updateToolbarPosition]);

        // Click outside closes toolbar (but not when template manager is open)
        useEffect(() => {
            const handleClickOutside = (e: MouseEvent) => {
                if (showTemplateManager) return;
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setShowToolbar(false);
                    setShowToneMenu(false);
                    setShowPromptInput(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [showTemplateManager]);

        // ── Apply result to textarea ─────────────────────────────────────────

        const applyResult = useCallback((result: string, selStart: number, selEnd: number, actionId: string) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const fullText = textarea.value;
            let newText: string;
            let newCursorPos: number;

            if (actionId === 'continue') {
                const insertPos = selEnd || fullText.length;
                newText = fullText.substring(0, insertPos) + result + fullText.substring(insertPos);
                newCursorPos = insertPos + result.length;
            } else if (selStart !== selEnd) {
                newText = fullText.substring(0, selStart) + result + fullText.substring(selEnd);
                newCursorPos = selStart + result.length;
            } else {
                newText = result;
                newCursorPos = result.length;
            }

            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            setter?.call(textarea, newText);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            onValueChange?.(newText);

            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        }, [textareaRef, onValueChange]);

        // ── Execute built-in action ──────────────────────────────────────────

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

                if (!response.ok) throw new Error('AI request failed');

                const data = await response.json();
                if (data.result) applyResult(data.result, selStart, selEnd, actionId);
            } catch (error) {
                console.error('[AITextarea] Action failed:', error);
            } finally {
                setIsProcessing(false);
                setProcessingAction(null);
                setShowToolbar(false);
                setShowToneMenu(false);
            }
        };

        // ── Execute custom / template prompt ─────────────────────────────────

        const executeCustomPrompt = async (promptText: string) => {
            const textarea = textareaRef.current;
            if (!textarea || !promptText.trim()) return;

            const fullText = textarea.value;
            const selStart = textarea.selectionStart;
            const selEnd = textarea.selectionEnd;
            const selectedText = fullText.substring(selStart, selEnd);

            setIsProcessing(true);
            setProcessingAction('custom:' + promptText.slice(0, 20));

            try {
                const response = await fetch('/api/scratchpad/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'custom',
                        customPrompt: promptText.trim(),
                        text: fullText,
                        selectedText: selectedText || undefined,
                    }),
                });

                if (!response.ok) throw new Error('AI request failed');

                const data = await response.json();
                if (data.result) applyResult(data.result, selStart, selEnd, 'custom');
            } catch (error) {
                console.error('[AITextarea] Custom prompt failed:', error);
            } finally {
                setIsProcessing(false);
                setProcessingAction(null);
                setShowToolbar(false);
                setShowToneMenu(false);
                setShowPromptInput(false);
                setCustomPromptText('');
            }
        };

        // ── Render ───────────────────────────────────────────────────────────

        return (
            <div ref={containerRef} className="relative w-full">

                {/* AI Floating Toolbar */}
                {enableAI && showToolbar && (
                    <div
                        className="absolute z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
                        style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
                    >
                        {showPromptInput ? (
                            /* ── Prompt input mode ── */
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border bg-background/95 backdrop-blur-md shadow-xl shadow-black/10 min-w-[360px]">
                                {/* Back */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setShowPromptInput(false); setCustomPromptText(''); }}
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </Button>

                                <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />

                                <input
                                    ref={promptInputRef}
                                    value={customPromptText}
                                    onChange={e => setCustomPromptText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); executeCustomPrompt(customPromptText); }
                                        if (e.key === 'Escape') { setShowPromptInput(false); setCustomPromptText(''); }
                                    }}
                                    placeholder="Type a prompt… (Enter to run)"
                                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                    disabled={isProcessing}
                                />

                                <Button
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0 bg-purple-500 hover:bg-purple-600 text-white"
                                    onClick={() => executeCustomPrompt(customPromptText)}
                                    disabled={!customPromptText.trim() || isProcessing}
                                >
                                    {isProcessing
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ArrowRight className="w-3.5 h-3.5" />}
                                </Button>
                            </div>
                        ) : (
                            /* ── Normal toolbar mode ── */
                            <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border bg-background/95 backdrop-blur-md shadow-xl shadow-black/10 flex-wrap">

                                {/* Sparkle label */}
                                <div className="flex items-center gap-1 pr-1 border-r mr-1">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="text-xs font-medium text-purple-500">AI</span>
                                </div>

                                {/* Built-in actions */}
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
                                        {isProcessing && processingAction === action.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : action.icon}
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
                                                    {isProcessing && processingAction === option.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : option.icon}
                                                    <span>{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* User templates */}
                                {templates.length > 0 && (
                                    <>
                                        <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />
                                        {templates.map(t => (
                                            <Button
                                                key={t.id}
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs gap-1.5 hover:bg-purple-500/10 hover:text-purple-600 max-w-[120px]"
                                                onClick={() => executeCustomPrompt(t.prompt)}
                                                disabled={isProcessing}
                                                title={t.prompt}
                                            >
                                                {isProcessing && processingAction?.startsWith('custom:') && processingAction === 'custom:' + t.prompt.slice(0, 20)
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />}
                                                <span className="truncate">{t.name}</span>
                                            </Button>
                                        ))}
                                    </>
                                )}

                                {/* Separator */}
                                <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />

                                {/* Ask AI (free prompt) */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1.5 hover:bg-purple-500/10 hover:text-purple-600"
                                    onClick={() => { setShowToneMenu(false); setShowPromptInput(true); }}
                                    disabled={isProcessing}
                                    title="Type a custom prompt"
                                >
                                    <Wand2 className="w-3.5 h-3.5" />
                                    Ask AI
                                </Button>

                                {/* Manage templates */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowTemplateManager(true)}
                                    title="Manage prompt templates"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </Button>

                                {/* Close */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setShowToolbar(false); setShowToneMenu(false); }}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
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

                {/* Template Manager Dialog */}
                <TemplateManager
                    open={showTemplateManager}
                    onOpenChange={setShowTemplateManager}
                    templates={templates}
                    onTemplatesChange={setTemplates}
                />
            </div>
        );
    }
);

AITextarea.displayName = 'AITextarea';
