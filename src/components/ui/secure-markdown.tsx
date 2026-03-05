/**
 * Secure Markdown Component
 * Renders markdown with XSS protection via rehype-sanitize
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from '@/components/ui/copy-button';

interface SecureMarkdownProps {
  children: string;
  className?: string;
  maxLength?: number;
}

/**
 * Custom schema that extends the default with additional safe elements
 * while keeping security strict.
 */
const customSchema = {
  ...defaultSchema,
  // Allow additional safe attributes
  attributes: {
    ...defaultSchema.attributes,
    // Allow code class for syntax highlighting
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    // Allow span class for inline styling
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    // Allow div class for custom containers
    div: [...(defaultSchema.attributes?.div || []), 'className'],
  },
};

/**
 * Secure markdown component that sanitizes HTML to prevent XSS attacks.
 *
 * Security features:
 * - Uses rehype-sanitize with strict default schema
 * - Strips all potentially dangerous HTML tags and attributes
 * - Allows only safe markdown rendering
 * - Optional max length to prevent DoS from huge content
 */
export function SecureMarkdown({ children, className = '', maxLength = 50000 }: SecureMarkdownProps) {
  // Truncate content if too long (prevents DoS)
  const content =
    children && children.length > maxLength
      ? children.substring(0, maxLength) + '\n\n... (content truncated)'
      : children || '';

  return (
    <div className={`prose dark:prose-invert prose-sm max-w-none break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, customSchema]]}
        components={{
          // Custom code block rendering with syntax highlighting
          code(props: any) {
            const { inline, className, children } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            return !inline && language ? (
              <div className="relative group/code block mb-4 mt-2">
                <div className="absolute right-2 top-2 z-10 bg-zinc-800/80 backdrop-blur-sm rounded-md opacity-0 group-hover/code:opacity-100 transition-opacity">
                  <CopyButton content={codeString} variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white" />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={language}
                  PreTag="div"
                  className="rounded-md !m-0"
                  customStyle={{
                    borderRadius: '0.5rem',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className={className}>
                {children}
              </code>
            );
          },
          // Sanitize links
          a(props: any) {
            const { href, children } = props;
            // Only allow http, https, and mailto links
            const safeHref = href && /^(https?:|mailto:)/.test(href) ? href : undefined;
            return (
              <a
                href={safeHref}
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
          // Sanitize images
          img(props: any) {
            const { src, alt } = props;
            // Only allow http and https images
            const safeSrc = src && /^(https?:|data:image)/.test(src) ? src : undefined;
            return <img src={safeSrc} alt={alt} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Truncated markdown component for preview snippets
 */
export function SecureMarkdownTruncated({
  children,
  maxLength = 200,
  className = '',
}: {
  children: string;
  maxLength?: number;
  className?: string;
}) {
  const content = children || '';
  const truncated =
    content.length > maxLength ? content.substring(0, maxLength) + '...' : content;

  return <SecureMarkdown className={className}>{truncated}</SecureMarkdown>;
}
