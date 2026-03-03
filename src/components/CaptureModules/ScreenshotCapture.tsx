'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Upload, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenshotCaptureProps {
  onComplete?: () => void;
}

export function ScreenshotCapture({ onComplete }: ScreenshotCaptureProps) {
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.85): Promise<{ base64: string; dimensions: { width: number; height: number } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Store original dimensions
          const originalDimensions = { width: img.width, height: img.height };

          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed base64
          const compressedBase64 = canvas.toDataURL(file.type, quality);
          resolve({ base64: compressedBase64, dimensions: originalDimensions });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      // Compress images larger than 1MB
      const shouldCompress = file.size > 1024 * 1024; // 1MB

      if (shouldCompress) {
        const { base64, dimensions } = await compressImage(file);
        setImage(base64);
        setImageDimensions(dimensions);
        toast.info('Image compressed for better performance');
      } else {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Get dimensions for uncompressed images
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 0, height: 0 });
          img.src = base64;
        });

        setImage(base64);
        setImageDimensions(dimensions);
      }
    } catch (error) {
      toast.error('Failed to process image');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFileUpload(file);
          toast.success('Screenshot pasted from clipboard');
        }
        break;
      }
    }
  }, []);

  // Paste listener
  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleSubmit = async () => {
    if (!image) {
      toast.error('Please upload a screenshot');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'screenshot',
          title: title || 'Screenshot Capture',
          content: description || null,
          imageUrl: image,
          tags,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success('Screenshot saved to inbox!');
      setTitle('');
      setImage(null);
      setImageDimensions(null);
      setDescription('');
      setTags([]);
      
      onComplete?.();
    } catch (error) {
      toast.error('Failed to save screenshot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-medium"
      />

      {/* Image Upload/Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {image ? (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={image}
                alt="Screenshot"
                className="max-h-64 mx-auto rounded-lg shadow-sm"
              />
              {imageDimensions && (
                <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded-md">
                  {imageDimensions.width} × {imageDimensions.height}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImage(null);
                setImageDimensions(null);
              }}
            >
              Remove & Re-upload
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Drag & drop a screenshot, paste from clipboard, or
            </div>
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>
        )}
      </div>

      {/* Description */}
      <Textarea
        placeholder="Add notes or description..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="resize-none"
      />

      {/* Tags */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button onClick={() => handleRemoveTag(tag)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button size="icon" variant="outline" onClick={handleAddTag}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onComplete?.()}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !image}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save to Inbox
        </Button>
      </div>
    </div>
  );
}
