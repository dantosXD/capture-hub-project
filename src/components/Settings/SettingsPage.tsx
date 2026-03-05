'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Download, Info, Loader2, Monitor, Moon, Palette, Plus, RefreshCw, Save, Settings as SettingsIcon, ShieldAlert, Smartphone, Sparkles, Sun, TestTube2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

type ProviderType = 'OPENAI_COMPATIBLE' | 'ZAI';
type ThemeOption = 'light' | 'dark' | 'system';
type Connection = {
  id: string;
  label: string;
  providerType: ProviderType;
  baseUrl: string | null;
  isLocal: boolean;
  enabled: boolean;
  chatModel: string | null;
  visionModel: string | null;
  embeddingModel: string | null;
  lastHealthStatus: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'FAILED';
  lastHealthMessage: string | null;
  lastHealthCheckAt: string | null;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  source: 'database' | 'environment' | 'mock';
  readOnly: boolean;
  apiKey: string;
  clearApiKey: boolean;
};
type Preset = {
  id: string;
  label: string;
  providerType: ProviderType;
  baseUrl: string;
  isLocal: boolean;
  suggestedChatModel: string | null;
  suggestedVisionModel: string | null;
  suggestedEmbeddingModel: string | null;
};
type Routing = {
  defaultAIConnectionId: string | null;
  visionAIConnectionId: string | null;
  embeddingAIConnectionId: string | null;
  aiFallbackEnabled: boolean;
};

const APP_VERSION = '0.2.0';

const themeOptions: Array<{ value: ThemeOption; label: string; icon: typeof Sun; description: string }> = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Clean light theme' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Follows your OS preference' },
];

function hydrateConnection(connection: Omit<Connection, 'apiKey' | 'clearApiKey'>): Connection {
  return { ...connection, apiKey: '', clearApiKey: false };
}

function fromPreset(preset: Preset): Connection {
  return hydrateConnection({
    id: 'new',
    label: preset.label,
    providerType: preset.providerType,
    baseUrl: preset.baseUrl,
    isLocal: preset.isLocal,
    enabled: true,
    chatModel: preset.suggestedChatModel,
    visionModel: preset.suggestedVisionModel,
    embeddingModel: preset.suggestedEmbeddingModel,
    lastHealthStatus: 'UNKNOWN',
    lastHealthMessage: null,
    lastHealthCheckAt: null,
    apiKeyConfigured: false,
    apiKeyHint: null,
    source: 'database',
    readOnly: false,
  });
}

function healthVariant(status: Connection['lastHealthStatus']) {
  if (status === 'HEALTHY') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'DEGRADED') return 'secondary';
  return 'outline';
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { reconnect } = useWebSocket();
  const [deviceName, setDeviceName] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [routing, setRouting] = useState<Routing>({ defaultAIConnectionId: null, visionAIConnectionId: null, embeddingAIConnectionId: null, aiFallbackEnabled: true });
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('ollama');
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [loadingAI, setLoadingAI] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingRouting, setSavingRouting] = useState(false);
  const [importPayload, setImportPayload] = useState<Record<string, unknown> | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [resetPreview, setResetPreview] = useState<any>(null);
  const [loadingReset, setLoadingReset] = useState(true);
  const [clearing, setClearing] = useState(false);

  const databaseConnections = useMemo(() => connections.filter((connection) => connection.source === 'database' && connection.enabled), [connections]);

  const loadAI = async () => {
    setLoadingAI(true);
    try {
      const response = await fetch('/api/settings/ai');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load AI settings');
      setConnections((data.connections || []).map(hydrateConnection));
      setRouting(data.routing);
      setPresets(data.presets || []);
      setEncryptionAvailable(Boolean(data.encryptionAvailable));
      const preset = (data.presets || []).find((entry: Preset) => entry.id === selectedPresetId) || data.presets?.[0];
      if (preset) {
        setSelectedPresetId(preset.id);
        setNewConnection(fromPreset(preset));
      }
    } catch (error) {
      toast.error('Failed to load AI settings', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoadingAI(false);
    }
  };

  const loadResetPreview = async () => {
    setLoadingReset(true);
    try {
      const response = await fetch('/api/settings/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load data summary');
      setResetPreview(data.summary);
    } catch (error) {
      toast.error('Failed to load data summary', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoadingReset(false);
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem('capture-hub-device-name');
    if (savedName) setDeviceName(savedName);
    void loadAI();
    void loadResetPreview();
  }, []);

  const saveDevice = async () => {
    setSavingDevice(true);
    try {
      localStorage.setItem('capture-hub-device-name', deviceName.trim());
      window.dispatchEvent(new Event('capture-hub:device-name-updated'));
      reconnect();
      toast.success('Device name saved');
    } finally {
      setSavingDevice(false);
    }
  };

  const changeConnection = (id: string, patch: Partial<Connection>) => setConnections((current) => current.map((connection) => connection.id === id ? { ...connection, ...patch } : connection));
  const pickPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((entry) => entry.id === presetId);
    if (preset) setNewConnection(fromPreset(preset));
  };

  const persistConnection = async (connection: Connection, isNew = false) => {
    setSavingId(connection.id);
    try {
      const response = await fetch(isNew ? '/api/settings/ai/connections' : `/api/settings/ai/connections/${connection.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: connection.label,
          providerType: connection.providerType,
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey || null,
          clearApiKey: connection.clearApiKey,
          isLocal: connection.isLocal,
          enabled: connection.enabled,
          chatModel: connection.chatModel,
          visionModel: connection.visionModel,
          embeddingModel: connection.embeddingModel,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${isNew ? 'create' : 'save'} connection`);
      toast.success(isNew ? 'Connection created' : 'Connection saved');
      await loadAI();
    } catch (error) {
      toast.error(isNew ? 'Failed to create connection' : 'Failed to save connection', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSavingId(null);
    }
  };

  const testConnection = async (id: string) => {
    setTestingId(id);
    try {
      const response = await fetch(`/api/settings/ai/connections/${id}/test`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to test connection');
      toast.success(data.ok ? 'Connection healthy' : 'Connection test failed', { description: `${data.provider} responded in ${data.latencyMs}ms` });
      await loadAI();
    } catch (error) {
      toast.error('Failed to test connection', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestingId(null);
    }
  };

  const deleteConnection = async (id: string) => {
    setSavingId(id);
    try {
      const response = await fetch(`/api/settings/ai/connections/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete connection');
      toast.success('Connection deleted');
      await loadAI();
    } catch (error) {
      toast.error('Failed to delete connection', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSavingId(null);
    }
  };

  const saveRouting = async () => {
    setSavingRouting(true);
    try {
      const response = await fetch('/api/settings/ai/routing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(routing) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save routing');
      setRouting(data.routing);
      toast.success('Routing saved');
    } catch (error) {
      toast.error('Failed to save routing', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSavingRouting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const response = await fetch('/api/settings/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, dryRun: true }) });
      const preview = await response.json();
      if (!response.ok) throw new Error(preview.error || 'Failed to preview import');
      setImportPayload(data);
      setImportPreview(preview);
      setImportFileName(file.name);
      toast.success('Import analyzed');
    } catch (error) {
      toast.error('Import preview failed', { description: error instanceof Error ? error.message : 'Unknown error' });
      setImportPayload(null);
      setImportPreview(null);
      setImportFileName('');
    } finally {
      event.target.value = '';
    }
  };

  const confirmImport = async () => {
    if (!importPayload) return;
    setImporting(true);
    try {
      const response = await fetch('/api/settings/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: importPayload, dryRun: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import data');
      toast.success('Import completed', { description: `${data.summary.items} items, ${data.summary.projects} projects, ${data.summary.templates} templates, ${data.summary.links} links` });
      setImportPayload(null);
      setImportPreview(null);
      setImportFileName('');
      await loadResetPreview();
    } catch (error) {
      toast.error('Import failed', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setImporting(false);
    }
  };

  const clearAllData = async () => {
    setClearing(true);
    try {
      const response = await fetch('/api/settings/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear data');
      toast.success('Data cleared', { description: `${data.summary.items} items, ${data.summary.projects} projects, ${data.summary.templates} templates, ${data.summary.links} links removed` });
      await loadResetPreview();
    } catch (error) {
      toast.error('Failed to clear data', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 border-b border-border p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
          <SettingsIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Appearance, devices, AI providers, and data portability.</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-semibold">Appearance</h3></div>
            <div className="grid gap-2 sm:grid-cols-3">
              {themeOptions.map((option) => (
                <button key={option.value} onClick={() => setTheme(option.value)} className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left ${theme === option.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:bg-muted/40'}`}>
                  <option.icon className={`h-5 w-5 ${theme === option.value ? 'text-indigo-500' : 'text-muted-foreground'}`} />
                  <div className="flex-1"><div className="font-medium">{option.label}</div><div className="text-xs text-muted-foreground">{option.description}</div></div>
                  {theme === option.value && <CheckCircle2 className="h-5 w-5 text-indigo-500" />}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-semibold">Device</h3></div>
            <Card><CardContent className="space-y-4 pt-6"><div className="space-y-2"><Label htmlFor="device-name">Device Name</Label><Input id="device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="My Desk Setup" className="max-w-md" /></div><Button onClick={saveDevice} disabled={savingDevice} className="gap-2">{savingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Device Settings</Button></CardContent></Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-semibold">AI Configuration</h3></div>
            {!encryptionAvailable && <Card className="border-amber-500/30 bg-amber-500/10"><CardContent className="flex gap-3 py-4 text-sm"><ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300" /><div><div className="font-medium">`APP_ENCRYPTION_KEY` is not configured</div><div className="text-muted-foreground">Database-backed API keys cannot be stored yet. Local endpoints without keys and environment-backed connections still work.</div></div></CardContent></Card>}

            <Card>
              <CardHeader><CardTitle className="text-base">Add connection</CardTitle><CardDescription>OpenAI-compatible cloud or local runtimes plus legacy ZAI.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {loadingAI || !newConnection ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading AI settings...</div> : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2"><Label>Preset</Label><Select value={selectedPresetId} onValueChange={pickPreset}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Label</Label><Input value={newConnection.label} onChange={(event) => setNewConnection({ ...newConnection, label: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Base URL</Label><Input value={newConnection.baseUrl || ''} onChange={(event) => setNewConnection({ ...newConnection, baseUrl: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Chat Model</Label><Input value={newConnection.chatModel || ''} onChange={(event) => setNewConnection({ ...newConnection, chatModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Vision Model</Label><Input value={newConnection.visionModel || ''} onChange={(event) => setNewConnection({ ...newConnection, visionModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Embedding Model</Label><Input value={newConnection.embeddingModel || ''} onChange={(event) => setNewConnection({ ...newConnection, embeddingModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>API Key</Label><Input type="password" value={newConnection.apiKey} onChange={(event) => setNewConnection({ ...newConnection, apiKey: event.target.value })} placeholder={newConnection.isLocal ? 'Optional for local endpoints' : 'Enter API key'} /></div>
                      <div className="flex items-center gap-6 pt-6">
                        <div className="flex items-center gap-2"><Switch checked={newConnection.enabled} onCheckedChange={(checked) => setNewConnection({ ...newConnection, enabled: checked })} /><Label>Enabled</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={newConnection.isLocal} onCheckedChange={(checked) => setNewConnection({ ...newConnection, isLocal: checked })} /><Label>Local</Label></div>
                      </div>
                    </div>
                    <Button onClick={() => void persistConnection(newConnection, true)} disabled={savingId === 'new'} className="gap-2">{savingId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add Connection</Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Routing</CardTitle><CardDescription>Pick which enabled database-backed connection handles each capability.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['Default Chat', 'defaultAIConnectionId'],
                    ['Vision', 'visionAIConnectionId'],
                    ['Embeddings', 'embeddingAIConnectionId'],
                  ].map(([label, key]) => (
                    <div className="space-y-2" key={key}>
                      <Label>{label}</Label>
                      <Select value={(routing as any)[key] || 'automatic'} onValueChange={(value) => setRouting((current) => ({ ...current, [key]: value === 'automatic' ? null : value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="automatic">Automatic</SelectItem>{databaseConnections.map((connection) => <SelectItem key={connection.id} value={connection.id}>{connection.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2"><Switch checked={routing.aiFallbackEnabled} onCheckedChange={(checked) => setRouting((current) => ({ ...current, aiFallbackEnabled: checked }))} /><Label>Allow development fallback</Label></div>
                <Button onClick={saveRouting} disabled={savingRouting} className="gap-2">{savingRouting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Routing</Button>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {connections.map((connection) => (
                <Card key={connection.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">{connection.label}</CardTitle><Badge variant={healthVariant(connection.lastHealthStatus)}>{connection.lastHealthStatus}</Badge>{connection.readOnly && <Badge variant="outline">System</Badge>}{connection.isLocal && <Badge variant="secondary">Local</Badge>}</div>
                        <CardDescription>{connection.providerType} {connection.baseUrl ? `• ${connection.baseUrl}` : ''}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => void testConnection(connection.id)} disabled={testingId === connection.id}>{testingId === connection.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}Test</Button>
                        {!connection.readOnly && <Button size="sm" className="gap-2" onClick={() => void persistConnection(connection)} disabled={savingId === connection.id}>{savingId === connection.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</Button>}
                        {!connection.readOnly && <Button variant="destructive" size="sm" className="gap-2" onClick={() => void deleteConnection(connection.id)} disabled={savingId === connection.id}><Trash2 className="h-4 w-4" />Delete</Button>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {connection.lastHealthMessage && <div className="text-xs text-muted-foreground">{connection.lastHealthMessage}{connection.lastHealthCheckAt ? ` • ${new Date(connection.lastHealthCheckAt).toLocaleString()}` : ''}</div>}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2"><Label>Label</Label><Input value={connection.label} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { label: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Base URL</Label><Input value={connection.baseUrl || ''} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { baseUrl: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Chat Model</Label><Input value={connection.chatModel || ''} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { chatModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Vision Model</Label><Input value={connection.visionModel || ''} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { visionModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Embedding Model</Label><Input value={connection.embeddingModel || ''} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { embeddingModel: event.target.value })} /></div>
                      <div className="space-y-2"><Label>API Key</Label><Input type="password" value={connection.apiKey} disabled={connection.readOnly} onChange={(event) => changeConnection(connection.id, { apiKey: event.target.value, clearApiKey: false })} placeholder={connection.apiKeyConfigured ? `Stored (${connection.apiKeyHint || 'configured'})` : 'Optional for local endpoints'} /></div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2"><Switch checked={connection.enabled} disabled={connection.readOnly} onCheckedChange={(checked) => changeConnection(connection.id, { enabled: checked })} /><Label>Enabled</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={connection.isLocal} disabled={connection.readOnly} onCheckedChange={(checked) => changeConnection(connection.id, { isLocal: checked })} /><Label>Local</Label></div>
                      {!connection.readOnly && connection.apiKeyConfigured && <div className="flex items-center gap-2"><Switch checked={connection.clearApiKey} onCheckedChange={(checked) => changeConnection(connection.id, { clearApiKey: checked, apiKey: checked ? '' : connection.apiKey })} /><Label>Clear stored key</Label></div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-semibold">Data Management</h3></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Export</CardTitle><CardDescription>Download captures, projects, templates, and links as JSON.</CardDescription></CardHeader><CardContent><Button variant="outline" className="gap-2" onClick={() => window.open('/api/export?format=json', '_blank')}><Download className="h-4 w-4" />Export All Data</Button></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Import</CardTitle><CardDescription>Preview a JSON export before applying it.</CardDescription></CardHeader><CardContent className="space-y-4"><Input type="file" accept=".json" onChange={handleImport} />{importPreview && <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm"><div className="font-medium">{importFileName}</div><div>{importPreview.summary.items} items, {importPreview.summary.projects} projects, {importPreview.summary.templates} templates, {importPreview.summary.links} links</div><div className="text-muted-foreground">Existing matches: {importPreview.existingMatches.items} items, {importPreview.existingMatches.projects} projects, {importPreview.existingMatches.templates} templates, {importPreview.existingMatches.links} links</div>{importPreview.skippedLinks > 0 && <div className="text-amber-700 dark:text-amber-300">{importPreview.skippedLinks} link(s) will be skipped.</div>}<Button onClick={confirmImport} disabled={importing} className="gap-2">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Confirm Import</Button></div>}</CardContent></Card>
            </div>
            <Card className="border-destructive/40"><CardHeader><CardTitle className="text-base text-destructive">Clear all captured data</CardTitle><CardDescription>Permanently delete captures, projects, templates, and links from this instance.</CardDescription></CardHeader><CardContent className="space-y-4">{loadingReset ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading current counts...</div> : resetPreview && <div className="rounded-xl border bg-muted/30 p-4 text-sm">Preflight summary: {resetPreview.items} items, {resetPreview.projects} projects, {resetPreview.templates} templates, {resetPreview.links} links will be removed.<div className="mt-2 text-xs text-muted-foreground">Built-in default templates may reappear when Templates is opened again.</div></div>}<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" />Clear All Data</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Delete all captured data?</AlertDialogTitle><AlertDialogDescription>{resetPreview ? `This will remove ${resetPreview.items} items, ${resetPreview.projects} projects, ${resetPreview.templates} templates, and ${resetPreview.links} links.` : 'This will remove all captured data.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={clearAllData} disabled={clearing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{clearing ? 'Deleting...' : 'Delete Everything'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2"><Info className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-semibold">About</h3></div>
            <Card><CardContent className="grid gap-4 py-6 md:grid-cols-3"><div><div className="text-sm text-muted-foreground">Application</div><div className="font-medium">Capture Hub</div></div><div><div className="text-sm text-muted-foreground">Version</div><div className="font-medium">{APP_VERSION}</div></div><div><div className="text-sm text-muted-foreground">Focus</div><div className="font-medium">Capture + Recall</div></div></CardContent></Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
