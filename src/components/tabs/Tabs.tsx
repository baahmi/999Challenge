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
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>(
    () => [...Config.getCategoryNames()]
  );
  const suppressSelectionRef = useRef(false);

  useEffect(() => {
    const syncCategoryNames = () => {
      const next = [...Config.getCategoryNames()];
      setCategoryNames(next);
      // If selected tab no longer exists, fall back to Overview
      setValue(v => next.includes(v) || v === OVERVIEW_TAB || v === Config.getSelectedTab() ? v : OVERVIEW_TAB);
    };

    const unsubData = CustomDataStore.subscribe(syncCategoryNames);
    const unsubConfig = Config.getInstance().subscribe(syncCategoryNames);
    return () => {
      unsubData();
      unsubConfig();
    };
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
    return Config.getInstance().subscribe(handleConfigChange);
  }, []);

  useEffect(() => {
    const updateMaxWidth = () => {
      // Use viewport width instead of wrapper width to avoid measuring expanded wrapper
      const viewportWidth = window.innerWidth;
      const newMaxWidth = viewportWidth - 160; // 40px for each of the 4 buttons
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

  const scrollToEdge = (ref: React.RefObject<HTMLDivElement | null>, edge: 'start' | 'end') => {
    if (ref.current) {
      const scroller = ref.current.querySelector<HTMLElement>('.MuiTabs-scroller');
      const target = scroller ?? ref.current;
      target.scrollTo({ left: edge === 'start' ? 0 : target.scrollWidth, behavior: 'smooth' });
    }
  };

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    if (suppressSelectionRef.current) {
      suppressSelectionRef.current = false;
      return;
    }
    setValue(newValue);
    Config.setSelectedTab(newValue);
    onCategoryChange?.(newValue);
  };

  const reorderCategories = (fromCategory: string, toCategory: string) => {
    if (fromCategory === toCategory) return;
    const next = [...categoryNames];
    const fromIndex = next.indexOf(fromCategory);
    const toIndex = next.indexOf(toCategory);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    Config.setTabOrder(next);
  };

  const renderTabBar = (ref: React.RefObject<HTMLDivElement | null>, stickyClass: string) => (
    <div className={`tabs-wrapper ${stickyClass}`} style={{ backgroundColor: isDark ? '#1e1e1e' : '#fff' }}>
      <button
        className="tab-scroll-button"
        onClick={() => scrollToEdge(ref, 'start')}
        aria-label="Jump to first tab"
        title="Jump to first tab"
        style={{ color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
      >
        «
      </button>
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
            <Tab
              key={category}
              label={formatTabLabel(category)}
              value={category}
              draggable
              title="Drag to reorder"
              onDragStart={() => {
                setDraggedCategory(category);
                setDropTargetCategory(category);
              }}
              onDragEnd={() => {
                setDraggedCategory(null);
                setDropTargetCategory(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dropTargetCategory !== category) {
                  setDropTargetCategory(category);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedCategory && draggedCategory !== category) {
                  suppressSelectionRef.current = true;
                  reorderCategories(draggedCategory, category);
                  window.setTimeout(() => {
                    suppressSelectionRef.current = false;
                  }, 0);
                }
                setDraggedCategory(null);
                setDropTargetCategory(null);
              }}
              className={[
                'category-tab',
                draggedCategory === category ? 'category-tab-dragging' : '',
                dropTargetCategory === category && draggedCategory !== category ? 'category-tab-drop-target' : ''
              ].filter(Boolean).join(' ')}
              style={isDark && value !== category ? { color: 'rgba(255,255,255,0.6)' } : undefined}
            />
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
      <button
        className="tab-scroll-button"
        onClick={() => scrollToEdge(ref, 'end')}
        aria-label="Jump to last tab"
        title="Jump to last tab"
        style={{ color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
      >
        »
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
