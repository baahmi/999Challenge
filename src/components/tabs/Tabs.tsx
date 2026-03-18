import React, { useState, useEffect, useRef } from 'react';
import { TabContext, TabList } from '@mui/lab';
import { Tab, useColorScheme } from '@mui/material';
import { Config } from '../../config/Config';
import { CustomDataStore } from '../../data/CustomDataStore';
import { OVERVIEW_TAB } from '../overview/Overview';
import './Tabs.css';

interface TabsProps {
  onCategoryChange?: (category: string) => void;
  children?: React.ReactNode;
}

const formatTabLabel = (category: string): string => {
  if (category === 'All') return 'All';
  return category;
};

export function Tabs({ onCategoryChange, children }: TabsProps) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [value, setValue] = useState(Config.getSelectedTab());
  const [tabsPosition, setTabsPosition] = useState(Config.getTabsPosition());
  const [maxWidth, setMaxWidth] = useState<string>('auto');
  const [categoryNames, setCategoryNames] = useState<string[]>(
    () => [...Config.getCategoryNames()].sort((a, b) => a.localeCompare(b))
  );

  useEffect(() => {
    const unsub = CustomDataStore.subscribe(() => {
      const next = [...Config.getCategoryNames()].sort((a, b) => a.localeCompare(b));
      setCategoryNames(next);
      // If selected tab no longer exists, fall back to Overview
      setValue(v => next.includes(v) || v === Config.getSelectedTab() ? v : OVERVIEW_TAB);
    });
    return unsub;
  }, []);
  const tabListTopRef = useRef<HTMLDivElement>(null);
  const tabListBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasTop = tabsPosition === 'top' || tabsPosition === 'both';
    const hasBottom = tabsPosition === 'bottom' || tabsPosition === 'both';
    document.documentElement.style.setProperty('--sticky-top-offset', hasTop ? '48px' : '0px');
    document.documentElement.style.setProperty('--sticky-bottom-offset', hasBottom ? '48px' : '0px');
  }, [tabsPosition]);

  useEffect(() => {
    const handleConfigChange = () => {
      setValue(Config.getSelectedTab());
      setTabsPosition(Config.getTabsPosition());
    };

    // Subscribe to config changes
    const unsubscribe = Config.getInstance().subscribe(handleConfigChange);
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    const updateMaxWidth = () => {
      // Use viewport width instead of wrapper width to avoid measuring expanded wrapper
      const viewportWidth = window.innerWidth;
      const newMaxWidth = viewportWidth - 80; // 40px for each button
      setMaxWidth(`${newMaxWidth}px`);
    };

    updateMaxWidth();
    window.addEventListener('resize', updateMaxWidth);
    return () => window.removeEventListener('resize', updateMaxWidth);
  }, []);

  const scrollRef = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    const scrollAmount = 200;
    if (ref.current) {
      const scroller = ref.current.querySelector<HTMLElement>('.MuiTabs-scroller');
      const target = scroller ?? ref.current;
      target.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
    Config.setSelectedTab(newValue);
    onCategoryChange?.(newValue);
  };

  const renderTabBar = (ref: React.RefObject<HTMLDivElement | null>, stickyClass: string) => (
    <div className={`tabs-wrapper ${stickyClass}`} style={{ backgroundColor: isDark ? '#1e1e1e' : '#fff' }}>
      <button
        className="tab-scroll-button tab-scroll-left"
        onClick={() => scrollRef(ref, 'left')}
        aria-label="Previous tabs"
        title="Previous tabs"
        style={{ color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
      >
        ‹
      </button>
      <div className="tabs-scroll-container" ref={ref} style={{ maxWidth }}>
        <TabList onChange={handleChange} aria-label="category tabs">
          <Tab key={OVERVIEW_TAB} label={OVERVIEW_TAB} value={OVERVIEW_TAB}
            style={isDark && value !== OVERVIEW_TAB ? { color: 'rgba(255,255,255,0.6)' } : undefined} />
          {categoryNames.map((category) => (
            <Tab key={category} label={formatTabLabel(category)} value={category}
              style={isDark && value !== category ? { color: 'rgba(255,255,255,0.6)' } : undefined} />
          ))}
        </TabList>
      </div>
      <button
        className="tab-scroll-button tab-scroll-right"
        onClick={() => scrollRef(ref, 'right')}
        aria-label="Next tabs"
        title="Next tabs"
        style={{ color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
      >
        ›
      </button>
    </div>
  );

  return (
    <div className="tabs-container">
      <TabContext value={value}>
        {(tabsPosition === 'top' || tabsPosition === 'both') &&
          renderTabBar(tabListTopRef, 'tabs-sticky-top')}
        <div className="tab-content">
          {children}
        </div>
        {(tabsPosition === 'bottom' || tabsPosition === 'both') &&
          renderTabBar(tabListBottomRef, 'tabs-sticky-bottom')}
      </TabContext>
    </div>
  );
}
