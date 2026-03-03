'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Palette,
  Monitor,
  Sun,
  Moon,
  Save,
  Download,
  Upload,
  Key,
  Info,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Smartphone,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTheme } from '@/hooks/use-theme';

const APP_VERSION = '0.2.0';
const APP_NAME = 'Capture Hub';

type ThemeOption = 'light' | 'dark' | 'system';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [deviceName, setDeviceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedDeviceName = localStorage.getItem('capture-hub-device-name');
    const savedApiKey = localStorage.getItem('capture-hub-api-key');

    if (savedDeviceName) setDeviceName(savedDeviceName);
    if (savedApiKey) setApiKey(savedApiKey);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);

    try {
      // Save to localStorage
      localStorage.setItem('capture-hub-device-name', deviceName.trim());
      localStorage.setItem('capture-hub-api-key', apiKey.trim());

      toast.success('Settings saved', {
        description: 'Your preferences have been updated.',
      });
    } catch (error) {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const url = '/api/export?format=json';
      window.open(url, '_blank');

      toast.success('Export started', {
        description: 'Your data file should download shortly.',
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate JSON structure
        if (!Array.isArray(data.items)) {
          throw new Error('Invalid data format: missing items array');
        }

        // Import items one by one
        let imported = 0;
        let failed = 0;

        for (const item of data.items) {
          try {
            const response = await fetch('/api/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: item.type || 'note',
                title: item.title || 'Untitled',
                content: item.content || '',
                tags: item.tags || [],
                priority: item.priority || 'none',
                status: item.status || 'inbox',
                sourceUrl: item.sourceUrl || null,
                extractedText: item.extractedText || null,
                imageUrl: item.imageUrl || null,
              }),
            });

            if (response.ok) {
              imported++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }

        toast.success('Import completed', {
          description: `Imported ${imported} items${failed > 0 ? ` (${failed} failed)` : ''}`,
        });

        // Reset file input
        event.target.value = '';
      } catch (error) {
        toast.error('Import failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setImporting(false);
      }
    };

    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    try {
      // Get all items first
      const response = await fetch('/api/capture?limit=1000');
      const data = await response.json();

      // Delete all items
      let deleted = 0;
      for (const item of data.items || []) {
        const deleteResponse = await fetch(`/api/capture/${item.id}`, {
          method: 'DELETE',
        });
        if (deleteResponse.ok) {
          deleted++;
        }
      }

      toast.success('Data cleared', {
        description: `Deleted ${deleted} items.`,
      });
    } catch (error) {
      toast.error('Failed to clear data', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const themeOptions = [
    {
      value: 'light' as ThemeOption,
      label: 'Light',
      icon: Sun,
      description: 'Clean light theme',
    },
    {
      value: 'dark' as ThemeOption,
      label: 'Dark',
      icon: Moon,
      description: 'Easy on the eyes',
    },
    {
      value: 'system' as ThemeOption,
      label: 'System',
      icon: Monitor,
      description: 'Follows your OS preference',
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Customize your Capture Hub experience
          </p>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Appearance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Appearance</h3>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid gap-2">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        theme === option.value
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-border hover:border-border/80 hover:bg-muted/50'
                      }`}
                    >
                      <option.icon className={`w-5 h-5 ${
                        theme === option.value ? 'text-indigo-500' : 'text-muted-foreground'
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                      {theme === option.value && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Device Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Device</h3>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  placeholder="My Computer"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  This name helps identify this device in the connected devices list
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* AI Configuration Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">AI Configuration</h3>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and used for AI features like OCR and content extraction
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Data Management Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Data Management</h3>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-3">
                <Label>Export Data</Label>
                <p className="text-sm text-muted-foreground">
                  Download all your captures, projects, and templates as a JSON file
                </p>
                <Button
                  onClick={handleExportData}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export All Data
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Import Data</Label>
                <p className="text-sm text-muted-foreground">
                  Import previously exported data from a JSON file
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    disabled={importing}
                    className="max-w-md"
                  />
                  {importing && (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-destructive">Danger Zone</Label>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all data from this app
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="w-4 h-4" />
                      Clear All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        Are you sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your captures, projects, and templates.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAllData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>

          {/* About Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">About</h3>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Application</div>
                <div className="font-medium">{APP_NAME}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Version</div>
                <div className="font-medium">{APP_VERSION}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="text-sm">
                  An AI-powered personal information capture and organization hub
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
