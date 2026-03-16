import React, { useState, useEffect, useRef } from 'react';
import { TabContext, TabList } from '@mui/lab';
import { Tab } from '@mui/material';
import { Config } from '../../config/Config';
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
  const [categoryNames, setCategoryNames] = useState<string[]>(Config.getCategoryNames());
  const tabListRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const scroll = (direction: 'left' | 'right') => {
    const scrollAmount = 200;
    if (tabListRef.current) {
      const scroller = tabListRef.current.querySelector<HTMLElement>('.MuiTabs-scroller');
      const target = scroller ?? tabListRef.current;
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

  const tabsPositionClass = tabsPosition === 'top' ? 'tabs-top' : 'tabs-bottom';

  return (
    <div className={`tabs-container ${tabsPositionClass}`}>
      <TabContext value={value}>
        <div className="tabs-wrapper" ref={wrapperRef}>
          <button 
            className="tab-scroll-button tab-scroll-left" 
            onClick={() => scroll('left')}
            aria-label="Previous tabs"
            title="Previous tabs"
          >
            ‹
          </button>
          <div 
            className="tabs-scroll-container" 
            ref={tabListRef}
            style={{ maxWidth }}
          >
            <TabList onChange={handleChange} aria-label="category tabs">
              {categoryNames.map((category) => (
                <Tab key={category} label={formatTabLabel(category)} value={category} />
              ))}
            </TabList>
          </div>
          <button 
            className="tab-scroll-button tab-scroll-right" 
            onClick={() => scroll('right')}
            aria-label="Next tabs"
            title="Next tabs"
          >
            ›
          </button>
        </div>
        
        <div className="tab-content">
          {children}
        </div>
      </TabContext>
    </div>
  );
}
