'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  BookOpen,
  CheckSquare,
  MessageSquare,
  Layout,
  Briefcase,
  Star,
  Heart,
  Bookmark,
  Tag,
  Folder,
  Calendar,
  Clock,
  Bell,
  Search,
  Settings,
  User,
  Users,
  Mail,
  Phone,
  Globe,
  Home,
  Map,
  Camera,
  Image,
  Music,
  Video,
  Mic,
  Headphones,
  Wifi,
  Cloud,
  Sun,
  Moon,
  Zap,
  Flame,
  Lightbulb,
  Target,
  Flag,
  Award,
  Gift,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart,
  PieChart,
  Activity,
  Layers,
  Database,
  Code,
  Terminal,
  Bug,
  Rocket,
  Puzzle,
  Wrench,
  Hammer,
  Palette,
  Pen,
  Pencil,
  Scissors,
  Paperclip,
  Link,
  ExternalLink,
  Download,
  Upload,
  Share2,
  Send,
  Inbox,
  Archive,
  Trash2,
  Edit2,
  Copy,
  ClipboardList,
  List,
  ListChecks,
  AlignLeft,
  Hash,
  AtSign,
  AlertCircle,
  Info,
  HelpCircle,
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Frown,
  Coffee,
  Utensils,
  Car,
  Plane,
  Train,
  Ship,
  Bike,
  Footprints,
  GraduationCap,
  BookMarked,
  Newspaper,
  FileCode,
  FileSpreadsheet,
  FilePlus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

// Curated icon set with display names for searching
const ICON_MAP: Record<string, { icon: LucideIcon; keywords: string[] }> = {
  'file-text': { icon: FileText, keywords: ['document', 'text', 'file', 'note'] },
  'book-open': { icon: BookOpen, keywords: ['book', 'read', 'study', 'review'] },
  'check-square': { icon: CheckSquare, keywords: ['task', 'todo', 'check', 'done'] },
  'message-square': { icon: MessageSquare, keywords: ['message', 'chat', 'meeting', 'comment'] },
  'layout': { icon: Layout, keywords: ['layout', 'template', 'grid', 'general'] },
  'briefcase': { icon: Briefcase, keywords: ['work', 'business', 'project', 'job'] },
  'star': { icon: Star, keywords: ['star', 'favorite', 'important', 'rating'] },
  'heart': { icon: Heart, keywords: ['heart', 'love', 'health', 'favorite'] },
  'bookmark': { icon: Bookmark, keywords: ['bookmark', 'save', 'mark'] },
  'tag': { icon: Tag, keywords: ['tag', 'label', 'price'] },
  'folder': { icon: Folder, keywords: ['folder', 'directory', 'organize'] },
  'calendar': { icon: Calendar, keywords: ['calendar', 'date', 'schedule', 'event'] },
  'clock': { icon: Clock, keywords: ['clock', 'time', 'timer', 'schedule'] },
  'bell': { icon: Bell, keywords: ['bell', 'notification', 'alert', 'reminder'] },
  'search': { icon: Search, keywords: ['search', 'find', 'lookup'] },
  'settings': { icon: Settings, keywords: ['settings', 'config', 'gear', 'preferences'] },
  'user': { icon: User, keywords: ['user', 'person', 'profile', 'account'] },
  'users': { icon: Users, keywords: ['users', 'team', 'group', 'people'] },
  'mail': { icon: Mail, keywords: ['mail', 'email', 'letter', 'message'] },
  'phone': { icon: Phone, keywords: ['phone', 'call', 'contact'] },
  'globe': { icon: Globe, keywords: ['globe', 'web', 'world', 'internet'] },
  'home': { icon: Home, keywords: ['home', 'house', 'main'] },
  'map': { icon: Map, keywords: ['map', 'location', 'navigation', 'travel'] },
  'camera': { icon: Camera, keywords: ['camera', 'photo', 'picture'] },
  'image': { icon: Image, keywords: ['image', 'photo', 'picture', 'gallery'] },
  'music': { icon: Music, keywords: ['music', 'song', 'audio'] },
  'video': { icon: Video, keywords: ['video', 'movie', 'film', 'record'] },
  'mic': { icon: Mic, keywords: ['mic', 'microphone', 'voice', 'record'] },
  'headphones': { icon: Headphones, keywords: ['headphones', 'audio', 'music', 'listen'] },
  'wifi': { icon: Wifi, keywords: ['wifi', 'network', 'internet', 'connection'] },
  'cloud': { icon: Cloud, keywords: ['cloud', 'storage', 'sync', 'backup'] },
  'sun': { icon: Sun, keywords: ['sun', 'light', 'day', 'bright'] },
  'moon': { icon: Moon, keywords: ['moon', 'night', 'dark', 'sleep'] },
  'zap': { icon: Zap, keywords: ['zap', 'lightning', 'energy', 'power', 'fast'] },
  'flame': { icon: Flame, keywords: ['flame', 'fire', 'hot', 'trending'] },
  'lightbulb': { icon: Lightbulb, keywords: ['lightbulb', 'idea', 'innovation', 'tip'] },
  'target': { icon: Target, keywords: ['target', 'goal', 'aim', 'focus'] },
  'flag': { icon: Flag, keywords: ['flag', 'milestone', 'mark', 'report'] },
  'award': { icon: Award, keywords: ['award', 'trophy', 'achievement', 'prize'] },
  'gift': { icon: Gift, keywords: ['gift', 'present', 'reward'] },
  'shopping-cart': { icon: ShoppingCart, keywords: ['shopping', 'cart', 'buy', 'store'] },
  'credit-card': { icon: CreditCard, keywords: ['credit', 'card', 'payment', 'finance'] },
  'dollar-sign': { icon: DollarSign, keywords: ['dollar', 'money', 'finance', 'budget'] },
  'trending-up': { icon: TrendingUp, keywords: ['trending', 'growth', 'increase', 'analytics'] },
  'bar-chart': { icon: BarChart, keywords: ['chart', 'graph', 'analytics', 'data'] },
  'pie-chart': { icon: PieChart, keywords: ['pie', 'chart', 'analytics', 'data'] },
  'activity': { icon: Activity, keywords: ['activity', 'health', 'pulse', 'monitor'] },
  'layers': { icon: Layers, keywords: ['layers', 'stack', 'design'] },
  'database': { icon: Database, keywords: ['database', 'storage', 'data'] },
  'code': { icon: Code, keywords: ['code', 'programming', 'develop'] },
  'terminal': { icon: Terminal, keywords: ['terminal', 'console', 'command'] },
  'bug': { icon: Bug, keywords: ['bug', 'error', 'debug', 'issue'] },
  'rocket': { icon: Rocket, keywords: ['rocket', 'launch', 'startup', 'fast'] },
  'puzzle': { icon: Puzzle, keywords: ['puzzle', 'piece', 'plugin', 'extension'] },
  'wrench': { icon: Wrench, keywords: ['wrench', 'tool', 'fix', 'repair'] },
  'hammer': { icon: Hammer, keywords: ['hammer', 'build', 'construct'] },
  'palette': { icon: Palette, keywords: ['palette', 'color', 'design', 'art'] },
  'pen': { icon: Pen, keywords: ['pen', 'write', 'edit', 'compose'] },
  'pencil': { icon: Pencil, keywords: ['pencil', 'draw', 'sketch', 'edit'] },
  'scissors': { icon: Scissors, keywords: ['scissors', 'cut', 'trim'] },
  'paperclip': { icon: Paperclip, keywords: ['paperclip', 'attach', 'attachment'] },
  'link': { icon: Link, keywords: ['link', 'url', 'chain', 'connect'] },
  'external-link': { icon: ExternalLink, keywords: ['external', 'link', 'open', 'redirect'] },
  'download': { icon: Download, keywords: ['download', 'save', 'get'] },
  'upload': { icon: Upload, keywords: ['upload', 'send', 'publish'] },
  'share-2': { icon: Share2, keywords: ['share', 'social', 'distribute'] },
  'send': { icon: Send, keywords: ['send', 'submit', 'message'] },
  'inbox': { icon: Inbox, keywords: ['inbox', 'mail', 'receive'] },
  'archive': { icon: Archive, keywords: ['archive', 'store', 'backup'] },
  'trash-2': { icon: Trash2, keywords: ['trash', 'delete', 'remove'] },
  'edit-2': { icon: Edit2, keywords: ['edit', 'modify', 'change'] },
  'copy': { icon: Copy, keywords: ['copy', 'duplicate', 'clone'] },
  'clipboard-list': { icon: ClipboardList, keywords: ['clipboard', 'list', 'checklist', 'plan'] },
  'list': { icon: List, keywords: ['list', 'items', 'menu'] },
  'list-checks': { icon: ListChecks, keywords: ['list', 'checks', 'todo', 'tasks'] },
  'align-left': { icon: AlignLeft, keywords: ['align', 'text', 'paragraph'] },
  'hash': { icon: Hash, keywords: ['hash', 'number', 'tag', 'channel'] },
  'at-sign': { icon: AtSign, keywords: ['at', 'email', 'mention'] },
  'alert-circle': { icon: AlertCircle, keywords: ['alert', 'warning', 'error', 'caution'] },
  'info': { icon: Info, keywords: ['info', 'information', 'about', 'help'] },
  'help-circle': { icon: HelpCircle, keywords: ['help', 'question', 'support', 'faq'] },
  'shield': { icon: Shield, keywords: ['shield', 'security', 'protect', 'safe'] },
  'lock': { icon: Lock, keywords: ['lock', 'security', 'private', 'password'] },
  'key': { icon: Key, keywords: ['key', 'password', 'access', 'security'] },
  'eye': { icon: Eye, keywords: ['eye', 'view', 'visible', 'watch'] },
  'eye-off': { icon: EyeOff, keywords: ['eye', 'hidden', 'invisible', 'private'] },
  'thumbs-up': { icon: ThumbsUp, keywords: ['thumbs', 'like', 'approve', 'good'] },
  'thumbs-down': { icon: ThumbsDown, keywords: ['thumbs', 'dislike', 'reject', 'bad'] },
  'smile': { icon: Smile, keywords: ['smile', 'happy', 'emoji', 'face'] },
  'frown': { icon: Frown, keywords: ['frown', 'sad', 'unhappy', 'face'] },
  'coffee': { icon: Coffee, keywords: ['coffee', 'drink', 'break', 'cafe'] },
  'utensils': { icon: Utensils, keywords: ['utensils', 'food', 'restaurant', 'meal'] },
  'car': { icon: Car, keywords: ['car', 'drive', 'vehicle', 'travel'] },
  'plane': { icon: Plane, keywords: ['plane', 'flight', 'travel', 'trip'] },
  'train': { icon: Train, keywords: ['train', 'transport', 'commute'] },
  'ship': { icon: Ship, keywords: ['ship', 'boat', 'cruise', 'sea'] },
  'bike': { icon: Bike, keywords: ['bike', 'bicycle', 'cycling', 'exercise'] },
  'footprints': { icon: Footprints, keywords: ['footprints', 'walk', 'steps', 'hiking'] },
  'graduation-cap': { icon: GraduationCap, keywords: ['graduation', 'education', 'school', 'learn'] },
  'book-marked': { icon: BookMarked, keywords: ['book', 'marked', 'reading', 'reference'] },
  'newspaper': { icon: Newspaper, keywords: ['newspaper', 'news', 'article', 'press'] },
  'file-code': { icon: FileCode, keywords: ['file', 'code', 'script', 'programming'] },
  'file-spreadsheet': { icon: FileSpreadsheet, keywords: ['file', 'spreadsheet', 'excel', 'data'] },
  'file-plus': { icon: FilePlus, keywords: ['file', 'new', 'create', 'add'] },
};

export const DEFAULT_TEMPLATE_ICON = 'file-text';

// Get the icon names as a type
export type IconName = keyof typeof ICON_MAP;

// Helper to get an icon component by name
export function getIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) {
    return ICON_MAP[DEFAULT_TEMPLATE_ICON].icon;
  }
  return ICON_MAP[iconName].icon;
}

// Check if a string is a Lucide icon name (vs emoji)
export function isLucideIconName(value: string | null | undefined): boolean {
  if (!value) return false;
  return value in ICON_MAP;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search.trim()) {
      return Object.entries(ICON_MAP);
    }
    const query = search.toLowerCase().trim();
    return Object.entries(ICON_MAP).filter(([name, { keywords }]) => {
      return name.includes(query) || keywords.some(kw => kw.includes(query));
    });
  }, [search]);

  const SelectedIcon = getIconComponent(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-10 flex items-center justify-center gap-2"
          type="button"
        >
          <SelectedIcon className="w-5 h-5" />
          <span className="text-xs text-muted-foreground truncate">
            {isLucideIconName(value) ? value : DEFAULT_TEMPLATE_ICON}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <ScrollArea className="h-56">
            <div className="grid grid-cols-8 gap-1">
              {filteredIcons.map(([name, { icon: IconComponent }]) => (
                <button
                  key={name}
                  type="button"
                  className={`p-2 rounded-md hover:bg-accent flex items-center justify-center transition-colors ${
                    value === name
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : ''
                  }`}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setSearch('');
                  }}
                  title={name}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              ))}
              {filteredIcons.length === 0 && (
                <div className="col-span-8 text-center text-sm text-muted-foreground py-4">
                  No icons found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
