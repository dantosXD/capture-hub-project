'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Upload, Copy, Check, ZoomIn, ZoomOut, Maximize2, Minimize2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OCRToolProps {
  onComplete?: () => void;
}

interface OCRError {
  code: string;
  message: string;
  retryable: boolean;
}

export function OCRTool({ onComplete }: OCRToolProps) {
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<OCRError | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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

  const handleFileUpload = (file: File) => {
    // Clear any previous errors
    setError(null);

    // Validate file type - more thorough check
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!validImageTypes.includes(file.type)) {
      setError({
        code: 'INVALID_FILE_TYPE',
        message: `Unsupported file type: "${file.type || 'unknown'}". Please upload an image file (JPG, PNG, GIF, WebP, BMP, or SVG).`,
        retryable: false,
      });
      toast.error('Please upload a valid image file (JPG, PNG, GIF, WebP, BMP, or SVG)');
      return;
    }

    // Validate file size - warn if too large (> 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError({
        code: 'FILE_TOO_LARGE',
        message: `File is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`,
        retryable: false,
      });
      toast.error('File is too large. Maximum size is 10 MB.');
      return;
    }

    setFileName(file.name);
    setFileSize(formatFileSize(file.size));

    // Validate image can be read
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (!base64 || !base64.startsWith('data:image')) {
        setError({
          code: 'INVALID_IMAGE_DATA',
          message: 'The image file appears to be corrupt or unreadable. Please try a different file.',
          retryable: false,
        });
        toast.error('Failed to read image file');
        return;
      }
      setImage(base64);
      setExtractedText('');
    };
    reader.onerror = () => {
      setError({
        code: 'READ_ERROR',
        message: 'Failed to read the image file. The file may be corrupt.',
        retryable: false,
      });
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
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
          toast.success('Image pasted from clipboard');
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

  const handleExtract = async () => {
    if (!image) {
      toast.error('Please upload an image first');
      return;
    }

    // Clear previous errors
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/capture/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          title: title || 'OCR Capture',
          saveToInbox: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes from API
        if (response.status === 400) {
          setError({
            code: 'INVALID_REQUEST',
            message: data.error || 'Invalid request. Please check the image and try again.',
            retryable: true,
          });
          toast.error(data.error || 'Invalid request');
        } else if (response.status === 500) {
          // Check if it's an AI configuration error
          if (data.error?.includes('API key') || data.error?.includes('environment variable')) {
            setError({
              code: 'AI_NOT_CONFIGURED',
              message: 'AI service is not configured. Please set up your API key in the environment variables.',
              retryable: false,
            });
            toast.error('AI service not configured');
          } else {
            setError({
              code: 'EXTRACTION_FAILED',
              message: 'Failed to extract text from the image. The image may be too complex, blurry, or contain no readable text.',
              retryable: true,
            });
            toast.error('Failed to extract text from image');
          }
        } else if (response.status === 413) {
          setError({
            code: 'PAYLOAD_TOO_LARGE',
            message: 'The image file is too large to process. Please try a smaller image.',
            retryable: false,
          });
          toast.error('Image is too large to process');
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: `An error occurred (${response.status}): ${data.error || 'Unknown error'}`,
            retryable: true,
          });
          toast.error(`Failed to extract text: ${data.error || 'Unknown error'}`);
        }
        return;
      }

      // Success case
      setExtractedText(data.extractedText || '');

      // Handle mock text scenario
      if (data.extractedText?.includes('[Mock OCR Result')) {
        setError({
          code: 'AI_NOT_CONFIGURED',
          message: 'AI service is not configured. Showing mock result. Set ZAI_API_KEY or OPENAI_API_KEY for real OCR.',
          retryable: false,
        });
      }

      if (data.tags?.length > 0) {
        setTags(data.tags);
      }

      toast.success('Text extracted successfully!');
    } catch (error) {
      // Network errors or other exceptions
      setError({
        code: 'NETWORK_ERROR',
        message: 'Network error occurred. Please check your connection and try again.',
        retryable: true,
      });
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleExtract();
  };

  const handleCopyText = async () => {
    if (!extractedText) return;

    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('Clipboard API not available');
      }

      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for when clipboard API is not available
      console.error('Clipboard API error:', error);
      toast.error('Unable to copy to clipboard. Browser may not support this feature.');
    }
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setImageZoom(1);
  };

  const handleToggleExpand = () => {
    setIsExpanded(prev => !prev);
  };

  // Reset zoom when image changes
  useEffect(() => {
    setImageZoom(1);
    setIsExpanded(false);
  }, [image]);

  const handleSaveToInbox = async () => {
    if (!image) {
      toast.error('Please upload an image first');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/capture/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          title: title || 'OCR Capture',
          saveToInbox: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error scenarios
        if (response.status === 400) {
          setError({
            code: 'INVALID_REQUEST',
            message: data.error || 'Invalid request. Please check the image and try again.',
            retryable: true,
          });
        } else if (response.status === 500) {
          setError({
            code: 'SAVE_FAILED',
            message: 'Failed to save to inbox. Please try again.',
            retryable: true,
          });
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: `An error occurred (${response.status}): ${data.error || 'Unknown error'}`,
            retryable: true,
          });
        }
        toast.error(data.error || 'Failed to save');
        return;
      }

      toast.success('Saved to inbox!');
      setTitle('');
      setImage(null);
      setFileName(null);
      setFileSize(null);
      setExtractedText('');
      setTags([]);
      setError(null);

      onComplete?.();
    } catch (error) {
      setError({
        code: 'NETWORK_ERROR',
        message: 'Network error occurred. Please check your connection and try again.',
        retryable: true,
      });
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Title (optional)..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-medium"
      />

      {/* Image Upload/Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 relative ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20'
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {image ? (
          <div className="space-y-4">
            {/* Image Preview with Zoom Controls */}
            <div className={`relative ${isExpanded ? 'fixed inset-4 z-50 bg-background/95 backdrop-blur rounded-xl p-4 flex flex-col' : ''}`}>
              {/* Zoom Controls */}
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomOut}
                  disabled={imageZoom <= 0.5}
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomIn}
                  disabled={imageZoom >= 3}
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleResetZoom}
                  title="Reset zoom"
                >
                  <span className="text-xs font-medium">{Math.round(imageZoom * 100)}%</span>
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleExpand}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>

              {/* Image Container with Scroll */}
              <div className={`overflow-auto ${isExpanded ? 'flex-1 flex items-center justify-center' : 'max-h-96'} rounded-lg bg-muted/30`}
                   style={{ maxHeight: isExpanded ? 'calc(100vh - 200px)' : '400px' }}>
                <img
                  src={image}
                  alt="Uploaded"
                  className="max-w-full h-auto rounded-lg shadow-sm transition-transform duration-200"
                  style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
                />
              </div>

              {/* File Info */}
              {(fileName || fileSize) && !isExpanded && (
                <div className="text-sm text-muted-foreground text-center pt-2">
                  {fileName && <span className="font-medium">{fileName}</span>}
                  {fileName && fileSize && <span className="mx-2">•</span>}
                  {fileSize && <span>{fileSize}</span>}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImage(null);
                setFileName(null);
                setFileSize(null);
                setExtractedText('');
                setImageZoom(1);
                setIsExpanded(false);
              }}
            >
              Remove Image
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className={`w-10 h-10 mx-auto transition-colors ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
            <div className={`text-sm font-medium transition-colors ${isDragging ? 'text-primary text-base' : 'text-muted-foreground'}`}>
              {isDragging ? 'Drop image here' : 'Drag & drop an image, paste from clipboard, or'}
            </div>
            {!isDragging && (
              <>
                <div className="text-xs text-muted-foreground">
                  Supported: JPG, PNG, GIF, WebP, BMP, SVG
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="flex flex-col gap-2">
            <p className="font-medium text-red-900 dark:text-red-100">{error.message}</p>
            {error.retryable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="w-fit gap-2 border-red-200 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/30"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Extraction
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Extract Button */}
      {image && !extractedText && !error && (
        <Button
          onClick={handleExtract}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Extract Text
        </Button>
      )}
      {/* Side-by-Side Layout: Image Preview and Extracted Text */}
      {extractedText && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image Preview (Always Visible) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Image Preview</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={imageZoom <= 0.5}
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={imageZoom >= 3}
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleToggleExpand}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className={`relative rounded-lg border bg-muted/30 overflow-hidden ${isExpanded ? 'fixed inset-4 z-50 bg-background/95 backdrop-blur p-4' : ''}`}>
              <div className={`overflow-auto ${isExpanded ? 'h-[calc(100vh-200px)]' : 'max-h-64'} flex items-center justify-center`}>
                <img
                  src={image}
                  alt="Preview"
                  className="max-w-full h-auto transition-transform duration-200"
                  style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
                />
              </div>
            </div>
          </div>

          {/* Extracted Text */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Extracted Text</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyText}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              rows={12}
              className="resize-none h-64"
            />
          </div>
        </div>
      )}

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
        <Button onClick={handleSaveToInbox} disabled={loading || !image}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save to Inbox
        </Button>
      </div>
    </div>
  );
}
