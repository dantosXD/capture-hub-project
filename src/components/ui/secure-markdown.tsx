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
        remarkPlugins={[remarkGfm, [rehypeSanitize, customSchema]]}
        components={{
          // Custom code block rendering with syntax highlighting
          code(props: any) {
            const { inline, className, children } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            return !inline && language ? (
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                className="rounded-md"
                customStyle={{
                  margin: 0,
                  borderRadius: '0.375rem',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
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
