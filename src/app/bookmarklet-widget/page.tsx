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
  PenLine,
  Tag,
  Flag,
  FolderOpen,
  ExternalLink,
  Sparkles,
  CheckSquare,
  BookMarked,
} from 'lucide-react';

interface PageInfo {
  url: string;
  title: string;
  description: string;
  selectedText: string;
  favicon: string;
  ogImage: string;
  bodyText: string;
  firstImage: string;
  isCode: boolean;
}

interface DroppedFile {
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

type TabId = 'quick' | 'webpage' | 'selection' | 'screenshot' | 'clipboard' | 'image' | 'create';

const CONTENT_TYPES = [
  { id: 'note', label: 'Note', icon: <FileText className="w-4 h-4" /> },
  { id: 'task', label: 'Task', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'resource', label: 'Resource', icon: <BookMarked className="w-4 h-4" /> },
  { id: 'idea', label: 'Idea', icon: <Sparkles className="w-4 h-4" /> },
];

const PRIORITIES = [
  { id: 'none', label: 'None', color: 'text-slate-400' },
  { id: 'low', label: 'Low', color: 'text-blue-400' },
  { id: 'medium', label: 'Medium', color: 'text-amber-400' },
  { id: 'high', label: 'High', color: 'text-red-400' },
];

export default function BookmarkletWidget() {
  const [apiUrl, setApiUrl] = useState('');
  const [hubUrl, setHubUrl] = useState('');
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    url: '', title: '', description: '', selectedText: '',
    favicon: '', ogImage: '', bodyText: '', firstImage: '', isCode: false
  });
  const [activeTab, setActiveTab] = useState<TabId>('quick');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('none');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
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

  // Create tab state
  const [createType, setCreateType] = useState('note');
  const [createContent, setCreateContent] = useState('');

  // Read query params & initialize
  useEffect(() => {
    const base = `${window.location.protocol}//${window.location.host}`;
    setApiUrl(`${base}/api/bookmarklet`);
    setHubUrl(base);

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'popup') {
      setIsPopup(true);
      const url = params.get('url') || '';
      const titleParam = params.get('title') || '';
      const text = decodeURIComponent(params.get('text') || '');
      const desc = decodeURIComponent(params.get('desc') || '');
      const og = decodeURIComponent(params.get('og') || '');
      const img = decodeURIComponent(params.get('img') || '');
      const body = decodeURIComponent(params.get('body') || '');
      const fav = decodeURIComponent(params.get('fav') || '');
      const isCode = params.get('isCode') === '1';

      setPageInfo({ url, title: titleParam, description: desc, selectedText: text, favicon: fav, ogImage: og, bodyText: body, firstImage: img, isCode });
      if (titleParam) setTitle(titleParam);
      if (text) setActiveTab('selection');
      else if (img || og) setActiveTab('image');
    }

    // Persist last used tab
    const savedTab = sessionStorage.getItem('bookmarklet-tab') as TabId | null;
    if (savedTab && !params.get('text') && !params.get('img')) {
      setActiveTab(savedTab);
    }

    // Fetch projects
    fetch(`${base}/api/projects?limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.projects) setProjects(data.projects.slice(0, 20));
        else if (Array.isArray(data)) setProjects(data.slice(0, 20));
      })
      .catch(() => { });
  }, []);

  // Listen for messages from parent window (iframe mode)
  useEffect(() => {
    if (isPopup) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CAPTURE_HUB_PAGE_INFO') {
        const d = event.data;
        setPageInfo({ url: d.url || '', title: d.title || '', description: d.description || '', selectedText: d.selectedText || '', favicon: d.favicon || '', ogImage: d.ogImage || '', bodyText: d.bodyText || '', firstImage: d.firstImage || '', isCode: !!d.isCode });
        if (d.title) setTitle(d.title);
        if (d.selectedText) setActiveTab('selection');
        else if (d.firstImage || d.ogImage) setActiveTab('image');
      }
    };
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
            reader.onload = (ev) => { setPastedImage(ev.target?.result as string); setPastedText(null); };
            reader.readAsDataURL(file);
          }
          break;
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => { setPastedText(text); setPastedImage(null); });
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  const handleClose = useCallback(() => {
    if (isPopup) window.close();
    else window.parent.postMessage({ type: 'CAPTURE_HUB_CLOSE' }, '*');
  }, [isPopup]);

  const captureScreen = async () => {
    setScreenshotLoading(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } as MediaTrackConstraints });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      video.pause(); track.stop(); stream.getTracks().forEach(t => t.stop());
      setScreenshotImage(base64);
    } catch {
      setError('Screen capture cancelled or failed. Try again.');
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = Array.from(e.dataTransfer.files)[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setDroppedFile({ name: file.name, type: file.type, size: file.size, content: result, preview: file.type.startsWith('image/') ? result : undefined });
    };
    if (file.type.startsWith('image/')) reader.readAsDataURL(file);
    else reader.readAsText(file);
  }, []);

  const handleCapture = async () => {
    setLoading(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        sourceUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        pageDescription: pageInfo.description,
        favicon: pageInfo.favicon,
        ogImage: pageInfo.ogImage,
        bodyText: pageInfo.bodyText,
        isCode: pageInfo.isCode,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        priority,
        projectId: projectId || undefined,
      };

      if (activeTab === 'quick') {
        body.type = 'note'; body.title = title || pageInfo.title || 'Quick Note'; body.content = note;
      } else if (activeTab === 'webpage') {
        body.type = 'webpage'; body.title = title || pageInfo.title; body.content = note; body.bodyText = pageInfo.bodyText;
      } else if (activeTab === 'selection') {
        body.type = 'note'; body.title = title || `Selection from: ${pageInfo.title}`; body.selectedText = pageInfo.selectedText; body.content = note;
      } else if (activeTab === 'screenshot') {
        if (!screenshotImage) throw new Error('No screenshot captured');
        body.type = 'screenshot'; body.title = title || `Screenshot: ${pageInfo.title || 'Screen'}`; body.screenshot = screenshotImage; body.content = note;
      } else if (activeTab === 'clipboard') {
        if (pastedImage) { body.type = 'screenshot'; body.screenshot = pastedImage; body.content = note || 'Clipboard image'; body.title = title || 'Clipboard Image'; }
        else if (pastedText) { body.type = 'note'; body.content = pastedText + (note ? `\n\nNote: ${note}` : ''); body.title = title || 'Clipboard Text'; }
        else throw new Error('No clipboard content to capture');
      } else if (activeTab === 'image') {
        const imgSrc = pageInfo.firstImage || pageInfo.ogImage;
        if (!imgSrc) throw new Error('No image found on this page');
        body.type = 'image'; body.title = title || `Image from: ${pageInfo.title}`; body.screenshot = imgSrc; body.content = note;
      } else if (activeTab === 'create') {
        if (!title.trim() && !createContent.trim()) throw new Error('Enter a title or content to create');
        body.type = createType; body.title = title || 'Untitled'; body.content = createContent;
        // Remove page source for created content (it's original, not captured)
        body.sourceUrl = undefined;
      }

      if (droppedFile && activeTab !== 'create') {
        if (droppedFile.type.startsWith('image/')) { body.type = 'screenshot'; body.screenshot = droppedFile.content; body.title = title || droppedFile.name; body.content = note; }
        else { body.type = 'note'; body.title = title || droppedFile.name; body.content = droppedFile.content; }
      }

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();

      if (data.success) {
        setSavedItemId(data.item?.id || null);
        setSuccess(true);
        setTimeout(() => { if (isPopup) window.close(); }, 2500);
      } else {
        setError(data.error || 'Failed to capture. Please try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed. Is Capture Hub running?');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setError('');
    sessionStorage.setItem('bookmarklet-tab', id);
  };

  const canCapture = (): boolean => {
    if (droppedFile) return true;
    switch (activeTab) {
      case 'quick': return note.trim().length > 0;
      case 'webpage': return !!pageInfo.url;
      case 'selection': return pageInfo.selectedText.length > 0;
      case 'screenshot': return screenshotImage !== null;
      case 'clipboard': return pastedImage !== null || pastedText !== null;
      case 'image': return !!(pageInfo.firstImage || pageInfo.ogImage);
      case 'create': return title.trim().length > 0 || createContent.trim().length > 0;
      default: return false;
    }
  };

  const pageImage = pageInfo.ogImage || pageInfo.firstImage;

  const tabs = [
    { id: 'quick' as TabId, label: 'Note', icon: <PenLine className="w-3.5 h-3.5" /> },
    { id: 'webpage' as TabId, label: 'Page', icon: <Globe className="w-3.5 h-3.5" />, disabled: !pageInfo.url },
    { id: 'selection' as TabId, label: 'Quote', icon: <Quote className="w-3.5 h-3.5" />, disabled: !pageInfo.selectedText },
    { id: 'image' as TabId, label: 'Image', icon: <ImageIcon className="w-3.5 h-3.5" />, disabled: !pageImage },
    { id: 'screenshot' as TabId, label: 'Screen', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'clipboard' as TabId, label: 'Paste', icon: <Clipboard className="w-3.5 h-3.5" /> },
    { id: 'create' as TabId, label: 'Create', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans text-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-dashed border-indigo-400 rounded-2xl p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-indigo-400" />
              <p className="text-lg font-medium">Drop to capture</p>
              <p className="text-xs text-slate-300 mt-1">Images, text files, or documents</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs">C</div>
            <span className="font-semibold text-sm">Capture Hub</span>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Page Info Bar */}
        {pageInfo.url && (
          <div className="mb-3 px-3 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
            {pageInfo.favicon && <img src={pageInfo.favicon} alt="" className="w-4 h-4 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs truncate">{pageInfo.title}</p>
              <div className="flex items-center gap-1 text-slate-400" style={{ fontSize: '10px' }}>
                <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{pageInfo.url}</span>
              </div>
            </div>
            {pageImage && (
              <img src={pageImage} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0 border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>
        )}

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10 flex-1">
              <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <p className="text-base font-semibold mb-1">Captured!</p>
              <p className="text-xs text-slate-400 mb-4">Saved to your inbox</p>
              <a href={`${hubUrl}/?view=inbox`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-300 hover:bg-indigo-500/30 transition-colors text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Capture Hub
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main UI */}
        {!success && (
          <div className="flex flex-col flex-1 gap-2.5">
            {/* Dropped File Preview */}
            <AnimatePresence>
              {droppedFile && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center gap-2.5">
                  {droppedFile.preview ? (
                    <img src={droppedFile.preview} alt="" className="w-12 h-12 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                      <File className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-xs">{droppedFile.name}</p>
                    <p className="text-slate-400" style={{ fontSize: '10px' }}>{(droppedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => setDroppedFile(null)} className="p-1 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab Bar */}
            <div className="grid grid-cols-7 gap-0.5 bg-white/5 p-0.5 rounded-lg">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => !tab.disabled && handleTabChange(tab.id)} disabled={tab.disabled}
                  title={tab.label}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md transition-all ${activeTab === tab.id ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' :
                    tab.disabled ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}>
                  {tab.icon}
                  <span style={{ fontSize: '9px' }}>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Title field */}
            {activeTab !== 'create' && (
              <input type="text" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs" />
            )}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'quick' && (
                <motion.div key="quick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <textarea placeholder="Write your note... ideas, thoughts, reminders" value={note} onChange={(e) => setNote(e.target.value)} rows={5}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                </motion.div>
              )}

              {activeTab === 'webpage' && (
                <motion.div key="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  {pageInfo.description && (
                    <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2 line-clamp-2">{pageInfo.description}</p>
                  )}
                  {pageInfo.bodyText && (
                    <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                      <p className="text-slate-400 mb-1" style={{ fontSize: '10px' }}>Extracted text preview</p>
                      <p className="text-xs text-slate-300 line-clamp-3">{pageInfo.bodyText.slice(0, 300)}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">✓ AI will extract and summarize the full page content</p>
                  <textarea placeholder="Add a note (optional)..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                </motion.div>
              )}

              {activeTab === 'selection' && (
                <motion.div key="selection" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  <div className="p-2.5 bg-indigo-500/10 border-l-2 border-indigo-400 rounded-r-lg">
                    <div className="flex items-center gap-1.5 text-indigo-300 mb-1" style={{ fontSize: '10px' }}>
                      <Quote className="w-3 h-3" /> Selected text
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-5">{pageInfo.selectedText}</p>
                  </div>
                  <textarea placeholder="Your thoughts on this..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                </motion.div>
              )}

              {activeTab === 'image' && (
                <motion.div key="image" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  {pageImage ? (
                    <>
                      <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img src={pageImage} alt="Page image" className="w-full max-h-44 object-contain" />
                      </div>
                      <p className="text-slate-500 text-xs">{pageInfo.ogImage ? 'OG Image' : 'First image on page'}</p>
                      <textarea placeholder="Add a note about this image..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-500">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No image found on this page</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'screenshot' && (
                <motion.div key="screenshot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  {screenshotImage ? (
                    <>
                      <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img src={screenshotImage} alt="Screenshot" className="w-full max-h-44 object-contain" />
                      </div>
                      <button onClick={() => setScreenshotImage(null)} className="text-xs text-slate-400 hover:text-white">Retake screenshot</button>
                      <textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                    </>
                  ) : (
                    <button onClick={captureScreen} disabled={screenshotLoading}
                      className="w-full py-8 border-2 border-dashed border-white/20 hover:border-indigo-400 rounded-lg flex flex-col items-center gap-2 transition-colors group">
                      {screenshotLoading ? <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /> : <Camera className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />}
                      <p className="text-xs text-slate-400 group-hover:text-white transition-colors">{screenshotLoading ? 'Select a screen to capture...' : 'Click to capture screen'}</p>
                    </button>
                  )}
                </motion.div>
              )}

              {activeTab === 'clipboard' && (
                <motion.div key="clipboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  {pastedImage ? (
                    <>
                      <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img src={pastedImage} alt="Pasted" className="w-full max-h-44 object-contain" />
                      </div>
                      <button onClick={() => setPastedImage(null)} className="text-xs text-slate-400 hover:text-white">Paste something else</button>
                      <textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                    </>
                  ) : pastedText ? (
                    <>
                      <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-slate-400 mb-1" style={{ fontSize: '10px' }}>Pasted Text</p>
                        <p className="text-xs line-clamp-4">{pastedText}</p>
                      </div>
                      <button onClick={() => setPastedText(null)} className="text-xs text-slate-400 hover:text-white">Paste something else</button>
                      <textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                    </>
                  ) : (
                    <div className="py-8 border-2 border-dashed border-white/20 rounded-lg text-center">
                      <Clipboard className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-xs text-slate-400">Press Ctrl/Cmd+V to paste</p>
                      <p className="text-slate-500" style={{ fontSize: '10px' }}>Images or text from clipboard</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'create' && (
                <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                  {/* Content type picker */}
                  <div className="grid grid-cols-4 gap-1 bg-white/5 p-0.5 rounded-lg">
                    {CONTENT_TYPES.map((t) => (
                      <button key={t.id} onClick={() => setCreateType(t.id)}
                        className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-all ${createType === t.id ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                        {t.icon}
                        <span style={{ fontSize: '9px' }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs" />
                  <textarea placeholder="Content (optional)..." value={createContent} onChange={(e) => setCreateContent(e.target.value)} rows={4}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none text-xs" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Metadata Row: Tags + Priority */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Tag className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input type="text" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs" />
              </div>
              <div className="relative">
                <Flag className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-xs appearance-none">
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label} Priority</option>)}
                </select>
              </div>
            </div>

            {/* Project selector */}
            {projects.length > 0 && (
              <div className="relative">
                <FolderOpen className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-xs appearance-none">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-auto pt-1">
              <button onClick={handleClose}
                className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-colors text-xs">
                Cancel
              </button>
              <button onClick={handleCapture} disabled={loading || !canCapture()}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 text-xs">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {loading ? 'Saving...' : 'Capture'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
