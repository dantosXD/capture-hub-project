import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - Export all data (supports filtered subsets via query params)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const validFormats = ['json', 'csv', 'markdown', 'md'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // --- Filter parameters (Feature #444: Export filtered subset) ---
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const tag = searchParams.get('tag');
    const pinned = searchParams.get('pinned');
    const projectId = searchParams.get('projectId');
    const search = searchParams.get('search');

    // Build where clause with all supported filters
    const where: CaptureItemWhereInput = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (priority) {
      where.priority = priority;
    }
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }
    if (pinned === 'true') {
      where.pinned = true;
    } else if (pinned === 'false') {
      where.pinned = false;
    }
    if (projectId) {
      where.projectId = projectId;
    }
    // Search filter: match title or content containing the search term
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    // Track which filters were applied for export metadata
    const appliedFilters: Record<string, string> = {};
    if (status && status !== 'all') appliedFilters.status = status;
    if (type) appliedFilters.type = type;
    if (priority) appliedFilters.priority = priority;
    if (assignedTo) appliedFilters.assignedTo = assignedTo;
    if (tag) appliedFilters.tag = tag;
    if (pinned) appliedFilters.pinned = pinned;
    if (projectId) appliedFilters.projectId = projectId;
    if (search) appliedFilters.search = search;
    const isFiltered = Object.keys(appliedFilters).length > 0;

    // Set a timeout for database queries
    const QUERY_TIMEOUT = 10000; // 10 seconds

    // Fetch all data in parallel with timeout
    const [items, projects, templates, links] = await Promise.race([
      Promise.all([
        // Get all items (with filters applied)
        db.captureItem.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        }),
        // Get all projects
        db.project.findMany({
          include: {
            _count: { select: { items: true } },
          },
        }),
        // Get all templates
        db.template.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        // Get all links
        db.itemLink.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), QUERY_TIMEOUT)
      ),
    ]) as [any[], any[], any[], any[]];

    // Parse JSON fields safely
    let parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    // Tag filter requires JS filtering (SQLite limitation with JSON fields)
    if (tag) {
      parsedItems = parsedItems.filter(item =>
        item.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
      );
    }

    if (format === 'markdown' || format === 'md') {
      // Helper: format date nicely
      const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr || dateStr === 'now()') return 'N/A';
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr;
          return d.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          return dateStr;
        }
      };

      // Type display names and icons
      const typeLabels: Record<string, { label: string; icon: string }> = {
        note: { label: 'Notes', icon: '📝' },
        screenshot: { label: 'Screenshots', icon: '📸' },
        ocr: { label: 'OCR Extractions', icon: '🔍' },
        webpage: { label: 'Web Pages', icon: '🌐' },
        scratchpad: { label: 'Scratchpad Entries', icon: '📋' },
      };

      // Group items by type
      const itemsByType: Record<string, typeof parsedItems> = {};
      for (const item of parsedItems) {
        const type = item.type || 'other';
        if (!itemsByType[type]) itemsByType[type] = [];
        itemsByType[type].push(item);
      }

      // Determine which sections exist for TOC
      const typeKeys = Object.keys(itemsByType);
      const hasProjects = projects.length > 0;
      const hasTemplates = templates.length > 0;
      const hasLinks = links.length > 0;

      // Generate Markdown
      let markdown = `# Capture Hub Export\n\n`;
      markdown += `**Exported:** ${formatDate(new Date().toISOString())}\n\n`;

      // Include filter info if filtered
      if (isFiltered) {
        markdown += `**Filters Applied:**\n`;
        for (const [key, value] of Object.entries(appliedFilters)) {
          markdown += `- ${key}: ${value}\n`;
        }
        markdown += `\n`;
      }

      // Statistics summary
      markdown += `## Summary\n\n`;
      markdown += `| Category | Count |\n`;
      markdown += `|----------|-------|\n`;
      markdown += `| Capture Items | ${parsedItems.length} |\n`;
      markdown += `| Projects | ${projects.length} |\n`;
      markdown += `| Templates | ${templates.length} |\n`;
      markdown += `| Knowledge Links | ${links.length} |\n\n`;

      // Status breakdown
      const statusCounts = {
        inbox: parsedItems.filter(i => i.status === 'inbox').length,
        assigned: parsedItems.filter(i => i.status === 'assigned').length,
        archived: parsedItems.filter(i => i.status === 'archived').length,
        trash: parsedItems.filter(i => i.status === 'trash').length,
      };
      markdown += `**By Status:** Inbox (${statusCounts.inbox}) · Assigned (${statusCounts.assigned}) · Archived (${statusCounts.archived}) · Trash (${statusCounts.trash})\n\n`;

      // Type breakdown
      const typeBreakdown = typeKeys
        .map(t => `${(typeLabels[t]?.icon || '📄')} ${typeLabels[t]?.label || t} (${itemsByType[t].length})`)
        .join(' · ');
      markdown += `**By Type:** ${typeBreakdown}\n\n`;
      markdown += `---\n\n`;

      // Table of Contents
      markdown += `## Table of Contents\n\n`;
      if (hasProjects) {
        markdown += `- [Projects](#projects)\n`;
      }
      for (const type of typeKeys) {
        const info = typeLabels[type] || { label: type.charAt(0).toUpperCase() + type.slice(1), icon: '📄' };
        markdown += `- [${info.icon} ${info.label}](#${info.label.toLowerCase().replace(/\s+/g, '-')})\n`;
      }
      if (hasTemplates) {
        markdown += `- [Templates](#templates)\n`;
      }
      if (hasLinks) {
        markdown += `- [Knowledge Links](#knowledge-links)\n`;
      }
      markdown += `\n---\n\n`;

      // Projects section
      if (hasProjects) {
        markdown += `## Projects\n\n`;
        for (const project of projects) {
          markdown += `### ${project.icon || '📁'} ${project.name}\n\n`;
          if (project.description) {
            markdown += `> ${project.description}\n\n`;
          }
          markdown += `| Field | Value |\n`;
          markdown += `|-------|-------|\n`;
          markdown += `| Status | ${project.status} |\n`;
          markdown += `| Priority | ${project.priority} |\n`;
          markdown += `| Items | ${project._count.items} |\n`;
          if (project.dueDate) {
            markdown += `| Due Date | ${formatDate(project.dueDate)} |\n`;
          }
          markdown += `| Created | ${formatDate(project.createdAt)} |\n`;
          markdown += `\n`;
        }
        markdown += `---\n\n`;
      }

      // Items grouped by type
      for (const type of typeKeys) {
        const typeItems = itemsByType[type];
        const info = typeLabels[type] || { label: type.charAt(0).toUpperCase() + type.slice(1), icon: '📄' };
        markdown += `## ${info.icon} ${info.label}\n\n`;
        markdown += `*${typeItems.length} item${typeItems.length !== 1 ? 's' : ''}*\n\n`;

        for (const item of typeItems) {
          markdown += `### ${item.title}\n\n`;

          // Metadata table
          markdown += `| Field | Value |\n`;
          markdown += `|-------|-------|\n`;
          markdown += `| Status | ${item.status} |\n`;
          markdown += `| Priority | ${item.priority} |\n`;
          if (item.tags.length > 0) {
            markdown += `| Tags | ${item.tags.map(t => `\`${t}\``).join(', ')} |\n`;
          }
          if (item.assignedTo) {
            markdown += `| Assigned To | ${item.assignedTo} |\n`;
          }
          if (item.dueDate) {
            markdown += `| Due Date | ${formatDate(item.dueDate)} |\n`;
          }
          if (item.projectId) {
            markdown += `| Project | ${item.projectId} |\n`;
          }
          markdown += `| Created | ${formatDate(item.createdAt)} |\n`;
          markdown += `| Updated | ${formatDate(item.updatedAt)} |\n`;
          markdown += `\n`;

          // Content
          if (item.content) {
            markdown += `${item.content}\n\n`;
          }

          // Extracted text (OCR)
          if (item.extractedText) {
            markdown += `**Extracted Text:**\n\n\`\`\`\n${item.extractedText}\n\`\`\`\n\n`;
          }

          // Image URL
          if (item.imageUrl) {
            markdown += `**Image:** ${item.imageUrl}\n\n`;
          }

          // Source URL
          if (item.sourceUrl) {
            markdown += `**Source:** [${item.sourceUrl}](${item.sourceUrl})\n\n`;
          }

          markdown += `---\n\n`;
        }
      }

      // Templates section
      if (hasTemplates) {
        markdown += `## Templates\n\n`;
        markdown += `*${templates.length} template${templates.length !== 1 ? 's' : ''}*\n\n`;
        for (const template of templates) {
          markdown += `### ${template.icon || '📄'} ${template.name}\n\n`;
          if (template.description) {
            markdown += `> ${template.description}\n\n`;
          }
          markdown += `- **Category:** ${template.category}\n`;
          if (template.projectId) {
            markdown += `- **Project:** ${template.projectId}\n`;
          }
          markdown += `- **Created:** ${formatDate(template.createdAt)}\n`;
          markdown += `\n\`\`\`\n${template.content}\n\`\`\`\n\n`;
          markdown += `---\n\n`;
        }
      }

      // Links section
      if (hasLinks) {
        markdown += `## Knowledge Links\n\n`;
        markdown += `*${links.length} link${links.length !== 1 ? 's' : ''}*\n\n`;
        markdown += `| Source | Target | Relation | Note |\n`;
        markdown += `|--------|--------|----------|------|\n`;
        for (const link of links) {
          markdown += `| ${link.sourceId} | ${link.targetId} | ${link.relationType} | ${link.note || '-'} |\n`;
        }
        markdown += `\n`;
      }

      const mdFilterSuffix = isFiltered ? '-filtered' : '';
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="capture-hub-export${mdFilterSuffix}-${new Date().toISOString().split('T')[0]}.md"`,
        },
      });
    }

    if (format === 'csv') {
      // Helper: escape a value for CSV (RFC 4180 compliant)
      // Handles commas, double quotes, newlines, and other special characters
      const csvEscape = (value: string | number | boolean | null | undefined): string => {
        if (value === null || value === undefined) return '""';
        const str = String(value);
        // Always wrap in double quotes; escape internal double quotes by doubling them
        return `"${str.replace(/"/g, '""')}"`;
      };

      // Feature #294: Include ALL item fields as columns
      const headers = [
        'ID',
        'Title',
        'Type',
        'Status',
        'Priority',
        'Tags',
        'Content',
        'Extracted Text',
        'Image URL',
        'Source URL',
        'Metadata',
        'Assigned To',
        'Due Date',
        'Reminder',
        'Reminder Sent',
        'Pinned',
        'Project ID',
        'Processed At',
        'Processed By',
        'Created At',
        'Updated At',
      ];
      let csv = headers.map(h => csvEscape(h)).join(',') + '\n';

      for (const item of parsedItems) {
        const row = [
          item.id,
          item.title || '',
          item.type || '',
          item.status || '',
          item.priority || '',
          Array.isArray(item.tags) ? item.tags.join('; ') : '',
          item.content || '',
          item.extractedText || '',
          item.imageUrl || '',
          item.sourceUrl || '',
          item.metadata ? JSON.stringify(item.metadata) : '',
          item.assignedTo || '',
          item.dueDate || '',
          item.reminder || '',
          item.reminderSent ? 'true' : 'false',
          item.pinned ? 'true' : 'false',
          item.projectId || '',
          item.processedAt || '',
          item.processedBy || '',
          item.createdAt || '',
          item.updatedAt || '',
        ].map(cell => csvEscape(cell)).join(',');

        csv += row + '\n';
      }

      // Build filename - include filter hint if filtered
      const filterSuffix = isFiltered ? '-filtered' : '';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="capture-hub-export${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: JSON format
    // Compute date range from items
    const itemDates = parsedItems
      .map(i => i.createdAt)
      .filter(Boolean)
      .sort();
    const dateRange = itemDates.length > 0
      ? { oldest: itemDates[0], newest: itemDates[itemDates.length - 1] }
      : { oldest: null, newest: null };

    // Parse template fields safely
    const parsedTemplates = templates.map(t => ({
      ...t,
      variables: safeParseJSON(t.variables),
    }));

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      // Feature #444: Include filter info in export metadata
      ...(isFiltered ? { filters: appliedFilters, filtered: true } : { filtered: false }),
      items: parsedItems,
      projects: projects.map(p => ({
        ...p,
        itemCount: p._count.items,
        _count: undefined,
      })),
      templates: parsedTemplates,
      links: links,
      stats: {
        totalItems: parsedItems.length,
        totalProjects: projects.length,
        totalTemplates: templates.length,
        totalLinks: links.length,
        dateRange,
        byStatus: {
          inbox: parsedItems.filter(i => i.status === 'inbox').length,
          assigned: parsedItems.filter(i => i.status === 'assigned').length,
          archived: parsedItems.filter(i => i.status === 'archived').length,
          trash: parsedItems.filter(i => i.status === 'trash').length,
        },
        byType: parsedItems.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };

    // Build filename - include filter hint if filtered
    const filterSuffix = isFiltered ? '-filtered' : '';
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="capture-hub-export${filterSuffix}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to export data' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/export]',
      error,
    });
  }
}
