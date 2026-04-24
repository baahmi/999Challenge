import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from '@mui/material';
import type { ItemRow } from '../../data/itemCalculations';
import './SearchOverlay.css';

type SearchResultType = 'tab' | 'item';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  targetCategory: string;
  category?: string;
  score: number;
}

interface SearchOverlayProps {
  open: boolean;
  categoryNames: string[];
  categoryData: Map<string, ItemRow[]>;
  onClose: () => void;
  onSelect: (category: string) => void;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchScore(label: string, query: string, type: SearchResultType): number | null {
  const text = normalize(label);
  const q = normalize(query);
  if (!q) return type === 'tab' ? 100 : 200;
  if (text === q) return type === 'tab' ? 0 : 1;
  if (text.startsWith(q)) return type === 'tab' ? 10 : 11;
  if (text.split(/[\s:()/-]+/).some(part => part.startsWith(q))) return type === 'tab' ? 20 : 21;
  const index = text.indexOf(q);
  if (index === -1) return null;
  return 30 + index + (type === 'tab' ? 0 : 1);
}

function buildResults(
  query: string,
  categoryNames: string[],
  categoryData: Map<string, ItemRow[]>,
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const category of categoryNames) {
    const score = matchScore(category, query, 'tab');
    if (score !== null) {
      results.push({
        id: `tab:${category}`,
        type: 'tab',
        label: category,
        targetCategory: category,
        score,
      });
    }
  }

  const seenItems = new Set<string>();
  for (const [category, rows] of categoryData.entries()) {
    for (const row of rows) {
      const targetCategory = row.category ?? category;
      const key = `${row.name}|${targetCategory}`;
      if (seenItems.has(key)) continue;
      seenItems.add(key);

      const score = matchScore(row.name, query, 'item');
      if (score === null) continue;
      results.push({
        id: `item:${targetCategory}:${row.name}`,
        type: 'item',
        label: row.name,
        category: targetCategory,
        targetCategory,
        score,
      });
    }
  }

  return results
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label) || a.targetCategory.localeCompare(b.targetCategory))
    .slice(0, 40);
}

export function SearchOverlay({ open, categoryNames, categoryData, onClose, onSelect }: SearchOverlayProps) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => buildResults(query, categoryNames, categoryData),
    [query, categoryNames, categoryData]
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(index => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const select = (result: SearchResult | undefined) => {
    if (!result) return;
    onSelect(result.targetCategory);
    onClose();
  };

  return (
    <div className="search-overlay-backdrop" onMouseDown={onClose}>
      <div
        className={`search-overlay ${isDark ? 'search-overlay-dark' : ''}`}
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectedIndex(index => Math.min(index + 1, Math.max(0, results.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelectedIndex(index => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              select(results[selectedIndex]);
            }
          }}
        />
        <div className="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">No matches</div>
          ) : results.map((result, index) => (
            <button
              key={result.id}
              className={`search-result ${index === selectedIndex ? 'search-result-selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => select(result)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className="search-result-main">
                <span className="search-result-label">{result.label}</span>
                {result.type === 'item' && result.category && (
                  <span className="search-result-category">{result.category}</span>
                )}
              </span>
              <span className="search-result-type">{result.type === 'tab' ? 'Tab' : 'Item'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
