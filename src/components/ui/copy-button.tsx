'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CopyButtonProps {
    content: string;
    className?: string;
    variant?: 'outline' | 'ghost' | 'secondary' | 'default';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    hideText?: boolean;
}

export function CopyButton({
    content,
    className,
    variant = 'ghost',
    size = 'icon',
    hideText = true
}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!content) return;

        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            toast.error('Failed to copy to clipboard');
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={cn(
                "transition-all duration-200",
                copied ? "text-green-500 hover:text-green-600" : "text-muted-foreground hover:text-foreground",
                className
            )}
            onClick={handleCopy}
            title="Copy to clipboard"
        >
            {copied ? (
                <>
                    <Check className="h-4 w-4" />
                    {!hideText && <span className="ml-2">Copied!</span>}
                </>
            ) : (
                <>
                    <Copy className="h-4 w-4" />
                    {!hideText && <span className="ml-2">Copy</span>}
                </>
            )}
        </Button>
    );
}
