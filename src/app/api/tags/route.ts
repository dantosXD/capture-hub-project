import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';

/**
 * GET /api/tags - Get all tags with usage counts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'count'; // 'count' | 'name'
    const order = searchParams.get('order') || 'desc'; // 'asc' | 'desc'

    // Get all capture items
    const items = await db.captureItem.findMany({
      select: { tags: true, id: true },
    });

    // Aggregate tags with counts
    const tagMap = new Map<string, number>();

    for (const item of items) {
      const tags = safeParseTags(item.tags);
      for (const tag of tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    // Convert to array and sort
    let tags = Array.from(tagMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Sort by count (descending) or name (ascending/descending)
    if (sort === 'count') {
      tags.sort((a, b) => order === 'asc' ? a.count - b.count : b.count - a.count);
    } else if (sort === 'name') {
      tags.sort((a, b) => order === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
      );
    }

    return NextResponse.json({ tags });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch tags' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/tags]',
      error,
    });
  }
}

/**
 * POST /api/tags - Create a new tag (validation only, tags are stored on items)
 *
 * Note: Tags don't have a separate table - they're stored as JSON on CaptureItem.
 * This endpoint validates that a tag name is acceptable and can be used.
 * It doesn't create a database record, but returns success if the tag name is valid.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return apiError('Tag name is required', 400, {
        logPrefix: '[POST /api/tags]',
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return apiError('Tag name cannot be empty', 400, {
        logPrefix: '[POST /api/tags]',
      });
    }

    if (trimmedName.length > 50) {
      return apiError('Tag name must be 50 characters or less', 400, {
        logPrefix: '[POST /api/tags]',
      });
    }

    // Check for invalid characters
    if (/[<>{}\\]/.test(trimmedName)) {
      return apiError('Tag name contains invalid characters', 400, {
        logPrefix: '[POST /api/tags]',
      });
    }

    // Check if tag already exists
    const items = await db.captureItem.findMany({
      select: { tags: true },
    });

    const existingTags = new Set<string>();
    for (const item of items) {
      const tags = safeParseTags(item.tags);
      for (const tag of tags) {
        existingTags.add(tag.toLowerCase());
      }
    }

    if (existingTags.has(trimmedName.toLowerCase())) {
      return apiError('Tag already exists', 409, {
        logPrefix: '[POST /api/tags]',
      });
    }

    // Tag is valid - return success
    // The tag will be "created" when it's first added to an item
    return NextResponse.json({
      success: true,
      tag: {
        name: trimmedName,
        count: 0,
      },
    }, { status: 201 });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to create tag' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/tags]',
      error,
    });
  }
}

/**
 * PATCH /api/tags - Rename or merge a tag
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldName, newName, mergeInto } = body;

    // Rename tag
    if (oldName && newName) {
      if (!oldName.trim() || !newName.trim()) {
        return apiError('Both old and new tag names are required', 400, {
          logPrefix: '[PATCH /api/tags]',
        });
      }

      if (newName.length > 50) {
        return apiError('Tag name must be 50 characters or less', 400, {
          logPrefix: '[PATCH /api/tags]',
        });
      }

      // Get all items with the old tag
      const items = await db.captureItem.findMany({
        where: {
          tags: { contains: oldName },
        },
      });

      // Update each item
      for (const item of items) {
        const tags = safeParseTags(item.tags);
        const index = tags.indexOf(oldName);
        if (index !== -1) {
          tags[index] = newName.trim();
        }

        await db.captureItem.update({
          where: { id: item.id },
          data: {
            tags: JSON.stringify(tags),
            // updatedAt handled by @updatedAt
          },
        });
      }

      return NextResponse.json({
        success: true,
        renamed: oldName,
        to: newName.trim(),
        affectedItems: items.length,
      });
    }

    // Merge tags
    if (mergeInto && oldName) {
      if (!mergeInto.trim() || !oldName.trim()) {
        return apiError('Both source tag and target tag are required', 400, {
          logPrefix: '[PATCH /api/tags]',
        });
      }

      if (mergeInto === oldName) {
        return apiError('Cannot merge a tag into itself', 400, {
          logPrefix: '[PATCH /api/tags]',
        });
      }

      // Get all items with the old tag
      const items = await db.captureItem.findMany({
        where: {
          tags: { contains: oldName },
        },
      });

      // Update each item - replace old tag with merge target
      for (const item of items) {
        const tags = safeParseTags(item.tags);
        const filteredTags = tags.filter(t => t !== oldName);

        // Add merge target if not already present
        if (!filteredTags.includes(mergeInto)) {
          filteredTags.push(mergeInto);
        }

        await db.captureItem.update({
          where: { id: item.id },
          data: {
            tags: JSON.stringify(filteredTags),
            // updatedAt handled by @updatedAt
          },
        });
      }

      return NextResponse.json({
        success: true,
        merged: oldName,
        into: mergeInto,
        affectedItems: items.length,
      });
    }

    return apiError('Invalid request. Provide oldName+newName to rename, or oldName+mergeInto to merge', 400, {
      logPrefix: '[PATCH /api/tags]',
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to update tag' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[PATCH /api/tags]',
      error,
    });
  }
}

/**
 * DELETE /api/tags - Delete a tag (remove from all items)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name || !name.trim()) {
      return apiError('Tag name is required', 400, {
        logPrefix: '[DELETE /api/tags]',
      });
    }

    // Get all items with this tag
    const items = await db.captureItem.findMany({
      where: {
        tags: { contains: name },
      },
    });

    // Remove tag from each item
    for (const item of items) {
      const tags = safeParseTags(item.tags);
      const filteredTags = tags.filter(t => t !== name);

      await db.captureItem.update({
        where: { id: item.id },
        data: {
          tags: JSON.stringify(filteredTags),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: name,
      affectedItems: items.length,
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to delete tag' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[DELETE /api/tags]',
      error,
    });
  }
}
