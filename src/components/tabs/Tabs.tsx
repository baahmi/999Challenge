import React, { useState, useEffect, useRef } from 'react';
import { TabContext, TabList } from '@mui/lab';
import { Tab } from '@mui/material';
import { Config } from '../../config/Config';
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
  const [value, setValue] = useState(Config.getSelectedTab());
  const [tabsPosition, setTabsPosition] = useState(Config.getTabsPosition());
  const [maxWidth, setMaxWidth] = useState<string>('auto');
  const [categoryNames, setCategoryNames] = useState<string[]>(
    [...Config.getCategoryNames()].sort((a, b) => a.localeCompare(b))
  );
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
    <div className={`tabs-wrapper ${stickyClass}`}>
      <button
        className="tab-scroll-button tab-scroll-left"
        onClick={() => scrollRef(ref, 'left')}
        aria-label="Previous tabs"
        title="Previous tabs"
      >
        ‹
      </button>
      <div className="tabs-scroll-container" ref={ref} style={{ maxWidth }}>
        <TabList onChange={handleChange} aria-label="category tabs">
          <Tab key={OVERVIEW_TAB} label={OVERVIEW_TAB} value={OVERVIEW_TAB} />
          {categoryNames.map((category) => (
            <Tab key={category} label={formatTabLabel(category)} value={category} />
          ))}
        </TabList>
      </div>
      <button
        className="tab-scroll-button tab-scroll-right"
        onClick={() => scrollRef(ref, 'right')}
        aria-label="Next tabs"
        title="Next tabs"
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
