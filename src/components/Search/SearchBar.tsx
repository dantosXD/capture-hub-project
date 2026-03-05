'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  X, 
  Loader2, 
  FileText, 
  Edit3, 
  ScanLine, 
  Camera, 
  Globe,
  Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchResultsSkeleton } from '@/components/LoadingStates/SearchResultsSkeleton';
import { typeTextColors } from '@/lib/type-colors';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  content: string | null;
  tags: string[];
}

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onResultClick?: (item: SearchResult) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4" />,
  scratchpad: <Edit3 className="w-4 h-4" />,
  ocr: <ScanLine className="w-4 h-4" />,
  screenshot: <Camera className="w-4 h-4" />,
  webpage: <Globe className="w-4 h-4" />,
};

const typeColors = typeTextColors;

export function SearchBar({ onSearch, onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, useAI]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key to close results (when focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const performSearch = async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      if (useAI) params.set('ai', 'true');

      const response = await fetch(`/api/search?${params}`, {
        signal: abortController.signal,
      });
      const data = await response.json();

      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setResults(data.items || []);
        setShowResults(true);
        onSearch?.(query);
      }
    } catch (error) {
      // Only log error if not due to abort
      if ((error as Error).name !== 'AbortError') {
        console.error('Search failed:', error);
      }
    } finally {
      // Only clear loading if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleResultClick = (item: SearchResult) => {
    onResultClick?.(item);
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          aria-label="Search captures"
          placeholder="Search your captures... (Press / to focus)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* AI Toggle */}
          <Button
            variant={useAI ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setUseAI(!useAI)}
            title="AI-enhanced search"
          >
            <Sparkles className={`w-3.5 h-3.5 ${useAI ? 'text-primary-foreground' : ''}`} />
          </Button>
          
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleClear}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showResults && loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <SearchResultsSkeleton />
          </motion.div>
        )}

        {showResults && results.length > 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {results.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleResultClick(item)}
                >
                  <div className={typeColors[item.type]}>
                    {typeIcons[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title}</div>
                    {item.content && (
                      <div className="text-sm text-muted-foreground truncate">
                        {item.content.substring(0, 80)}...
                      </div>
                    )}
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Search Footer */}
            <div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>{results.length} results</span>
              {useAI && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Enhanced
                </Badge>
              )}
            </div>
          </motion.div>
        )}

        {/* No Results */}
        {showResults && query.trim().length >= 2 && results.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 p-4 text-center max-w-md"
          >
            <Search className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium mb-1">No results found for "{query}"</p>
            <p className="text-xs text-muted-foreground mb-3">Try different keywords or check your spelling</p>

            <div className="text-left bg-muted/50 rounded-lg p-3 mt-2">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                Search Tips
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Use fewer words for broader results</li>
                <li>• Search by tags, titles, or content</li>
                <li>• Try related terms or synonyms</li>
                <li>• Toggle AI search for semantic matching</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
