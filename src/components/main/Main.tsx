import React, { useState, useEffect, useMemo } from 'react';
import { Config } from '../../config/Config';
import { AppData } from '../../app/AppData';
import { computeCategoryItems, logDataIssues } from '../../data/itemCalculations';
import { Tabs } from '../tabs/Tabs';
import { ItemTable } from '../table/ItemTable';
import './Main.css';

export function Main() {
  const [selectedCategory, setSelectedCategory] = useState(Config.getSelectedTab());
  const [compacted, setCompacted] = useState<Array<{ name: string; stack: number; quality?: number[] }>>([]);
  const [quality, setQuality] = useState(Config.getQuality());

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
      const list = Array.isArray(raw) ? raw : [];
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

  const categoryNames = useMemo(() => Config.getCategoryNames(), []);

  const allCategoryData = useMemo(
    () => new Map(categoryNames.map(cat => [cat, computeCategoryItems(cat, compacted)])),
    [categoryNames, compacted, quality]  // quality triggers recompute when setting changes
  );

  return (
    <main className="main">
      <div className="container">
        <Tabs onCategoryChange={handleCategoryChange}>
          <ItemTable key={selectedCategory} items={allCategoryData.get(selectedCategory) ?? []} />
        </Tabs>
      </div>
    </main>
  );
}