import React, { useState, useEffect, useMemo } from 'react';
import { Config } from '../../config/Config';
import { AppData } from '../../app/AppData';
import { CustomDataStore } from '../../data/CustomDataStore';
import { computeCategoryItems, logDataIssues, type ItemRow } from '../../data/itemCalculations';
import { Tabs } from '../tabs/Tabs';
import { ItemTable } from '../table/ItemTable';
import { Overview, OVERVIEW_TAB } from '../overview/Overview';
import { SearchOverlay } from '../search/SearchOverlay';
import './Main.css';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

export function Main() {
  const [selectedCategory, setSelectedCategory] = useState(Config.getSelectedTab());
  const [compacted, setCompacted] = useState<Array<{ name: string; stack: number; quality?: number[] }>>([]);
  const [quality, setQuality] = useState(Config.getQuality());
  const [allCategoryData, setAllCategoryData] = useState<Map<string, ItemRow[]>>(new Map());
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleConfigChange = () => {
      setSelectedCategory(Config.getSelectedTab());
      setQuality(Config.getQuality());
    };
    const unsubscribe = Config.getInstance().subscribe(handleConfigChange);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleDataChange = () => {
      const state = AppData.getState();
      const raw = state.compacted as unknown as Array<{ name: string; stack: number }>;
      const list = Array.isArray(raw) ? [...raw] : [];
      setCompacted(list);
      if (list.length > 0) {
        logDataIssues(list);
      }
    };
    const unsubscribe = AppData.subscribe(handleDataChange);
    return unsubscribe;
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    Config.setSelectedTab(category);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [categoryNames, setCategoryNames] = useState<string[]>(() => Config.getCategoryNames());

  useEffect(() => {
    const syncCategoryNames = () => setCategoryNames(Config.getCategoryNames());
    const unsubData = CustomDataStore.subscribe(syncCategoryNames);
    const unsubConfig = Config.getInstance().subscribe(syncCategoryNames);
    return () => {
      unsubData();
      unsubConfig();
    };
  }, []);

  // Compute data when compacted, categoryNames, or quality changes
  useEffect(() => {
    if (compacted.length === 0) return;
    
    const map = new Map<string, ItemRow[]>();
    for (const cat of categoryNames) {
      map.set(cat, computeCategoryItems(cat, compacted));
    }
    setAllCategoryData(map);
  }, [categoryNames, compacted, quality]);

  return (
    <main className="main">
      <div className="container">
        <Tabs onCategoryChange={handleCategoryChange}>
          {selectedCategory === OVERVIEW_TAB && (
            <Overview compacted={compacted} categoryNames={categoryNames} onCategorySelect={selectCategory} />
          )}
          {selectedCategory !== OVERVIEW_TAB && (
            <ItemTable key={selectedCategory} items={allCategoryData.get(selectedCategory) ?? []} />
          )}
        </Tabs>
        <SearchOverlay
          open={searchOpen}
          categoryNames={[OVERVIEW_TAB, ...categoryNames]}
          categoryData={allCategoryData}
          onClose={() => setSearchOpen(false)}
          onSelect={selectCategory}
        />
      </div>
    </main>
  );
}
