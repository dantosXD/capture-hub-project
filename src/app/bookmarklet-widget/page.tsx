'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Globe,
  Link2,
  Send,
  Loader2,
  Check,
  Quote,
  Camera,
  Clipboard,
  Upload,
  Image as ImageIcon,
  File,
  AlertCircle,
} from 'lucide-react';

interface PageInfo {
  url: string;
  title: string;
  description: string;
  selectedText: string;
  favicon: string;
}

interface DroppedFile {
  name: string;
  type: string;
  size: number;
  content: string; // base64 for images/text content for text files
  preview?: string; // for images
}

export default function BookmarkletWidget() {
  const [apiUrl, setApiUrl] = useState('');
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    url: '',
    title: '',
    description: '',
    selectedText: '',
    favicon: '',
  });
  const [activeTab, setActiveTab] = useState<'quick' | 'screenshot' | 'clipboard' | 'page' | 'selection'>('quick');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isPopup, setIsPopup] = useState(false);

  // Screenshot state
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // Clipboard state
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState<string | null>(null);

  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<DroppedFile | null>(null);

  // Set API URL and read query params on mount
  useEffect(() => {
    setApiUrl(`${window.location.protocol}//${window.location.host}/api/bookmarklet`);

    // Check for popup mode with query params
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'popup') {
      setIsPopup(true);
      const url = params.get('url') || '';
      const titleParam = params.get('title') || '';
      const text = params.get('text') || '';
      const desc = params.get('desc') || '';

      setPageInfo({
        url,
        title: titleParam,
        description: desc,
        selectedText: text,
        favicon: '',
      });

      if (titleParam) {
        setTitle(titleParam);
      }

      if (text) {
        setActiveTab('selection');
      }
    }
  }, []);

  // Listen for messages from parent window (iframe mode)
  useEffect(() => {
    if (isPopup) return; // Skip iframe messaging in popup mode

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CAPTURE_HUB_PAGE_INFO') {
        setPageInfo({
          url: event.data.url || '',
          title: event.data.title || '',
          description: event.data.description || '',
          selectedText: event.data.selectedText || '',
          favicon: event.data.favicon || '',
        });

        // Set default title
        if (event.data.title) {
          setTitle(event.data.title);
        }

        // If there's selected text, switch to selection tab
        if (event.data.selectedText) {
          setActiveTab('selection');
        }
      }
    };

    // Request page info from parent
    window.parent.postMessage({ type: 'CAPTURE_HUB_REQUEST_INFO' }, '*');

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopup]);

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'clipboard') return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setPastedImage(ev.target?.result as string);
              setPastedText(null);
            };
            reader.readAsDataURL(file);
          }
          break;
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => {
            setPastedText(text);
            setPastedImage(null);
          });
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  const handleClose = useCallback(() => {
    if (isPopup) {
      window.close();
    } else {
      window.parent.postMessage({ type: 'CAPTURE_HUB_CLOSE' }, '*');
    }
  }, [isPopup]);

  // Screen capture function
  const captureScreen = async () => {
    setScreenshotLoading(true);
    setError('');
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: 'monitor' } as MediaTrackConstraints 
      });
      
      const track = stream.getVideoTracks()[0];
      
      // Use ImageCapture if available, otherwise use video element
      if ('ImageCapture' in window) {
        const capture = new ImageCapture(track);
        // @ts-expect-error - grabFrame not in TypeScript ImageCapture type
        const bitmap = await capture.grabFrame();
        
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0);
        
        const base64 = canvas.toDataURL('image/png');
        track.stop();
        stream.getTracks().forEach(t => t.stop());
        
        setScreenshotImage(base64);
      } else {
        // Fallback for browsers without ImageCapture
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        const base64 = canvas.toDataURL('image/png');
        video.pause();
        track.stop();
        stream.getTracks().forEach(t => t.stop());
        
        setScreenshotImage(base64);
      }
    } catch (e) {
      console.error('Screen capture error:', e);
      setError('Screen capture cancelled or failed');
    } finally {
      setScreenshotLoading(false);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    const file = files[0]; // Handle first file
    
    const processFile = () => {
      return new Promise<DroppedFile>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            content: result,
            preview: file.type.startsWith('image/') ? result : undefined,
          });
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    };
    
    processFile()
      .then(setDroppedFile)
      .catch(() => setError('Failed to read file'));
  }, []);

  const handleCapture = async (type: 'note' | 'webpage' | 'selection' | 'screenshot' | 'clipboard' | 'file') => {
    setLoading(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        type: type === 'selection' ? 'note' : type,
        title: title || pageInfo.title || 'Untitled Capture',
        sourceUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        pageDescription: pageInfo.description,
        favicon: pageInfo.favicon,
      };

      if (type === 'note') {
        body.content = note;
      } else if (type === 'selection') {
        body.selectedText = pageInfo.selectedText;
        body.content = note ? `${pageInfo.selectedText}\n\nNote: ${note}` : pageInfo.selectedText;
      } else if (type === 'webpage') {
        body.content = note;
      } else if (type === 'screenshot') {
        if (screenshotImage) {
          body.screenshot = screenshotImage;
          body.content = note || 'Screen capture';
          body.type = 'screenshot';
        } else {
          throw new Error('No screenshot captured');
        }
      } else if (type === 'clipboard') {
        if (pastedImage) {
          body.screenshot = pastedImage;
          body.type = 'screenshot';
          body.content = note || 'Clipboard image';
        } else if (pastedText) {
          body.content = pastedText + (note ? `\n\nNote: ${note}` : '');
          body.type = 'note';
        } else {
          throw new Error('No clipboard content');
        }
      } else if (type === 'file' && droppedFile) {
        if (droppedFile.type.startsWith('image/')) {
          body.screenshot = droppedFile.content;
          body.type = 'screenshot';
          body.content = note || `Dropped image: ${droppedFile.name}`;
        } else {
          body.content = droppedFile.content;
          body.type = 'note';
          body.title = title || droppedFile.name;
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(data.error || 'Failed to capture');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'quick', label: 'Note', icon: <FileText className="w-4 h-4" /> },
    { id: 'screenshot', label: 'Screenshot', icon: <Camera className="w-4 h-4" /> },
    { id: 'clipboard', label: 'Clipboard', icon: <Clipboard className="w-4 h-4" /> },
    { id: 'page', label: 'Page', icon: <Globe className="w-4 h-4" /> },
    { id: 'selection', label: 'Selection', icon: <Quote className="w-4 h-4" />, disabled: !pageInfo.selectedText },
  ];

  // Determine if we have content to capture based on active tab
  const canCapture = () => {
    switch (activeTab) {
      case 'quick':
        return note.trim().length > 0;
      case 'screenshot':
        return screenshotImage !== null;
      case 'clipboard':
        return pastedImage !== null || pastedText !== null;
      case 'page':
        return pageInfo.url.length > 0;
      case 'selection':
        return pageInfo.selectedText.length > 0;
      default:
        return false;
    }
  };

  const getCaptureType = (): 'note' | 'webpage' | 'selection' | 'screenshot' | 'clipboard' | 'file' => {
    switch (activeTab) {
      case 'quick':
        return 'note';
      case 'screenshot':
        return 'screenshot';
      case 'clipboard':
        return 'clipboard';
      case 'page':
        return 'webpage';
      case 'selection':
        return 'selection';
      default:
        return 'note';
    }
  };

  // Reset tab-specific state when switching tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as typeof activeTab);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      <div 
        className="p-4 min-h-screen"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <div className="border-2 border-dashed border-indigo-400 rounded-2xl p-12 text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 text-indigo-400" />
                <p className="text-xl font-medium text-white">Drop file here</p>
                <p className="text-sm text-slate-300 mt-2">Images, text files, or any document</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <span className="font-semibold">Capture Hub</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Page Info */}
        {pageInfo.url && (
          <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 text-sm">
              {pageInfo.favicon && (
                <img src={pageInfo.favicon} alt="" className="w-4 h-4" />
              )}
              <span className="font-medium truncate">{pageInfo.title}</span>
            </div>
            <div className="mt-1 text-xs text-slate-300 truncate flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              {pageInfo.url}
            </div>
          </div>
        )}

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-3">
                <Check className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-lg font-medium">Captured!</p>
              <p className="text-sm text-slate-300">Sent to your inbox</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropped File Preview */}
        <AnimatePresence>
          {droppedFile && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                {droppedFile.type.startsWith('image/') ? (
                  <img src={droppedFile.preview} alt="" className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 bg-white/10 rounded flex items-center justify-center">
                    <File className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{droppedFile.name}</p>
                  <p className="text-xs text-slate-300">
                    {(droppedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setDroppedFile(null)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {!success && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-white/5 p-1 rounded-lg overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && handleTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                      : tab.disabled
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Title Input */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'quick' && (
                <motion.div
                  key="quick"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <textarea
                    placeholder="Write your quick note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </motion.div>
              )}

              {activeTab === 'screenshot' && (
                <motion.div
                  key="screenshot"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {screenshotImage ? (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-white/10">
                        <img 
                          src={screenshotImage} 
                          alt="Screenshot" 
                          className="w-full max-h-48 object-contain bg-slate-800"
                        />
                      </div>
                      <button
                        onClick={() => setScreenshotImage(null)}
                        className="text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        Take another screenshot
                      </button>
                      <textarea
                        placeholder="Add a note about this screenshot..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={captureScreen}
                      disabled={screenshotLoading}
                      className="w-full py-8 border-2 border-dashed border-white/20 hover:border-indigo-400 rounded-lg flex flex-col items-center justify-center gap-3 transition-colors group"
                    >
                      {screenshotLoading ? (
                        <>
                          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                          <p className="text-slate-300">Select a screen to capture...</p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                          <p className="text-slate-300 group-hover:text-white transition-colors">Click to capture screen</p>
                          <p className="text-xs text-slate-400">Select a window, tab, or entire screen</p>
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              )}

              {activeTab === 'clipboard' && (
                <motion.div
                  key="clipboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {pastedImage ? (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-white/10">
                        <img 
                          src={pastedImage} 
                          alt="Pasted" 
                          className="w-full max-h-48 object-contain bg-slate-800"
                        />
                      </div>
                      <button
                        onClick={() => setPastedImage(null)}
                        className="text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        Paste something else
                      </button>
                      <textarea
                        placeholder="Add a note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  ) : pastedText ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-xs text-indigo-400 mb-1">Pasted Text</p>
                        <p className="text-sm line-clamp-4">{pastedText}</p>
                      </div>
                      <button
                        onClick={() => setPastedText(null)}
                        className="text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        Paste something else
                      </button>
                      <textarea
                        placeholder="Add a note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  ) : (
                    <div className="py-8 border-2 border-dashed border-white/20 rounded-lg text-center">
                      <Clipboard className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-300 mb-1">Press Ctrl/Cmd+V to paste</p>
                      <p className="text-xs text-slate-400">Images or text from your clipboard</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'page' && (
                <motion.div
                  key="page"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-slate-300">
                    Capture the full content of this page to your inbox. AI will extract and summarize the content.
                  </p>
                  <textarea
                    placeholder="Add a note (optional)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </motion.div>
              )}

              {activeTab === 'selection' && (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs mb-2">
                      <Quote className="w-3 h-3" />
                      Selected Text
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-4">
                      {pageInfo.selectedText}
                    </p>
                  </div>
                  <textarea
                    placeholder="Add your thoughts about this selection..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => droppedFile ? handleCapture('file') : handleCapture(getCaptureType())}
                disabled={loading || (droppedFile ? false : !canCapture())}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Capture
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
