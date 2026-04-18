import React, { useState, useEffect, useMemo } from 'react';
import { Config } from '../../config/Config';
import { AppData } from '../../app/AppData';
import { CustomDataStore } from '../../data/CustomDataStore';
import { computeCategoryItems, logDataIssues } from '../../data/itemCalculations';
import { Tabs } from '../tabs/Tabs';
import { ItemTable } from '../table/ItemTable';
import { Overview, OVERVIEW_TAB } from '../overview/Overview';
import './Main.css';

export function Main() {
  const [selectedCategory, setSelectedCategory] = useState(Config.getSelectedTab());
  const [compacted, setCompacted] = useState<Array<{ name: string; stack: number; quality?: number[] }>>([]);
  const [quality, setQuality] = useState(Config.getQuality());
  const [allCategoryData, setAllCategoryData] = useState<Map<string, any>>(new Map());

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

  const [categoryNames, setCategoryNames] = useState<string[]>(() => Config.getCategoryNames());

  useEffect(() => {
    const unsub = CustomDataStore.subscribe(() => setCategoryNames(Config.getCategoryNames()));
    return unsub;
  }, []);

  // Compute data when compacted, categoryNames, or quality changes
  useEffect(() => {
    if (compacted.length === 0) return;
    
    const map = new Map();
    for (const cat of categoryNames) {
      map.set(cat, computeCategoryItems(cat, compacted));
    }
    setAllCategoryData(map);
  }, [categoryNames, compacted, quality]);

  return (
    <main className="main">
      <div className="container">
        <Tabs onCategoryChange={handleCategoryChange}>
          {selectedCategory === OVERVIEW_TAB
            ? <Overview compacted={compacted} categoryNames={categoryNames} />
            : <ItemTable key={selectedCategory} items={allCategoryData.get(selectedCategory) ?? []} />
          }
        </Tabs>
      </div>
    </main>
  );
}