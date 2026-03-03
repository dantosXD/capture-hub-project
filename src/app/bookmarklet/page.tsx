'use client';

import { useState, useSyncExternalStore, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  Copy,
  Check,
  ExternalLink,
  MousePointer,
  GripVertical,
  Shield,
  Zap,
  Loader2,
  Settings,
  TestTube,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { toast } from 'sonner';

// Custom hook for client-only values - avoids hydration mismatch
function useClientOnlyValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(
    () => () => {}, // No subscription needed
    getClientValue,
    () => serverValue
  );
}

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  const [customName, setCustomName] = useState('Capture to Hub');
  const [serverUrl, setServerUrl] = useState('http://localhost:3333');
  const [showCustomize, setShowCustomize] = useState(false);
  const [testing, setTesting] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // Use client-only value for mounted check
  const mounted = useClientOnlyValue(() => true, false);

  // Derive API URL from server URL
  const apiUrl = serverUrl ? `${serverUrl}/api/bookmarklet` : '';

  // The bookmarklet code - popup approach avoids CSP/mixed-content issues
  const bookmarkletCode = serverUrl ? `javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title);var s='';try{s=encodeURIComponent((window.getSelection()||'').toString().trim())}catch(e){}var d='';var m=document.querySelector('meta[name="description"]');if(m)d=encodeURIComponent(m.getAttribute('content')||'');window.open('${serverUrl}/bookmarklet-widget?mode=popup&url='+u+'&title='+t+'&text='+s+'&desc='+d,'capture-hub','width=440,height=620,scrollbars=yes,resizable=yes')})();` : '';

  // Set href directly on DOM element to bypass React's security check
  useEffect(() => {
    if (bookmarkletRef.current && bookmarkletCode) {
      bookmarkletRef.current.href = bookmarkletCode;
    }
  }, [bookmarkletCode]);

  const handleCopyBookmarklet = useCallback(async () => {
    if (!bookmarkletCode) return;
    
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = bookmarkletCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [bookmarkletCode]);

  // Prevent click from executing bookmarklet on the page
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Test bookmarklet API connection
  const handleTest = useCallback(async () => {
    if (!apiUrl) return;

    setTesting(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Bookmarklet API is working!', {
          description: `Connected to: ${data.apiUrl || apiUrl}`,
        });
      } else {
        toast.error('Bookmarklet API test failed', {
          description: `Status: ${response.status} ${response.statusText}`,
        });
      }
    } catch (error) {
      toast.error('Connection failed', {
        description: error instanceof Error ? error.message : 'Could not connect to bookmarklet API',
      });
    } finally {
      setTesting(false);
    }
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 mb-6"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Capture Hub Bookmarklet
            </h1>
          </motion.div>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Capture anything from any webpage with a single click. Install the bookmarklet and use it across the entire web.
          </p>
        </div>

        {/* Customization Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className="w-full flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-indigo-400" />
              <span className="font-medium">Customize Bookmarklet</span>
            </div>
            <motion.div
              animate={{ rotate: showCustomize ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <GripVertical className="w-5 h-5 text-slate-400" />
            </motion.div>
          </button>

          {showCustomize && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl"
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="server-url" className="text-slate-300">Server URL</Label>
                  <Input
                    id="server-url"
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value.replace(/\/$/, ''))}
                    placeholder="http://localhost:3333"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    The URL of your Capture Hub server. Change this if you access it from a different address.
                  </p>
                </div>

                <div>
                  <Label htmlFor="custom-name" className="text-slate-300">Bookmarklet Name</Label>
                  <Input
                    id="custom-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Capture to Hub"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This is the name that will appear in your bookmarks bar
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing || !mounted}
                    className="gap-2 flex-1"
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    {testing ? 'Testing...' : 'Test API'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setCustomName('Capture to Hub')}
                    className="flex-1"
                  >
                    Reset to Default
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setServerUrl('http://localhost:3333')}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Reset URL
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Main Bookmarklet Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 mb-8"
        >
          <div className="flex items-center gap-4 justify-center mb-6">
            <div className="relative">
              {mounted ? (
                <a
                  ref={bookmarkletRef}
                  href="#" // Placeholder - real href set via ref
                  onClick={handleClick}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-medium text-lg cursor-grab shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-shadow"
                  style={{ textDecoration: 'none' }}
                >
                  <Bookmark className="w-5 h-5" />
                  {customName}
                </a>
              ) : (
                <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-medium text-lg shadow-lg shadow-indigo-500/25">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </div>
              )}
              {mounted && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse">
                  ↗
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-slate-300 mb-4">
            <GripVertical className="w-4 h-4 inline mr-1" />
            Drag this button to your bookmarks bar
          </p>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleCopyBookmarklet}
              className="gap-2"
              disabled={!mounted}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Back to Hub
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* How to Install */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MousePointer className="w-5 h-5 text-indigo-400" />
            How to Install
          </h2>
          <div className="grid gap-4">
            {[
              {
                step: 1,
                title: 'Show your bookmarks bar',
                description: 'Press Cmd+Shift+B (Mac) or Ctrl+Shift+B (Windows/Linux) to toggle the bookmarks bar visibility.',
              },
              {
                step: 2,
                title: 'Drag the button',
                description: 'Click and drag the "Capture to Hub" button above to your bookmarks bar.',
              },
              {
                step: 3,
                title: 'Start capturing!',
                description: 'Visit any webpage and click the bookmarklet. A floating capture window will appear.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-medium mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-300">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Alternative: Manual Install */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-400" />
            Alternative: Manual Install
          </h2>
          <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>Right-click on your bookmarks bar and select "Add Page" or "Add Bookmark"</li>
              <li>Name it "Capture to Hub"</li>
              <li>Copy the bookmarklet code below and paste it as the URL</li>
            </ol>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 gap-4 mb-8"
        >
          <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Zap className="w-6 h-6 text-amber-400 mb-3" />
            <h3 className="font-medium mb-2">Quick Notes</h3>
            <p className="text-sm text-slate-300">
              Jot down thoughts while browsing. Notes are saved with the page URL for context.
            </p>
          </div>
          <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <ExternalLink className="w-6 h-6 text-blue-400 mb-3" />
            <h3 className="font-medium mb-2">Page Capture</h3>
            <p className="text-sm text-slate-300">
              Save entire web pages with AI-extracted content, title, and metadata.
            </p>
          </div>
          <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <MousePointer className="w-6 h-6 text-purple-400 mb-3" />
            <h3 className="font-medium mb-2">Text Selection</h3>
            <p className="text-sm text-slate-300">
              Highlight text on any page and capture it with your annotations.
            </p>
          </div>
          <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Shield className="w-6 h-6 text-green-400 mb-3" />
            <h3 className="font-medium mb-2">Privacy First</h3>
            <p className="text-sm text-slate-300">
              Everything is saved locally to your Capture Hub instance. No third-party tracking.
            </p>
          </div>
        </motion.div>

        {/* Bookmarklet Code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
        >
          <h3 className="text-sm font-medium mb-2 text-slate-300">Bookmarklet Code (Advanced)</h3>
          <pre className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
            {mounted ? bookmarkletCode : 'Loading...'}
          </pre>
        </motion.div>
      </div>
    </div>
  );
}
