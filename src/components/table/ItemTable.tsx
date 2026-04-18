import React from 'react';
import { Tooltip, useColorScheme } from '@mui/material';
import { enrichItemsWithCalculations } from '../../types/Item';
import type { ItemWithCalculations } from '../../types/Item';
import type { ItemRow, ItemTooltipData } from '../../data/itemCalculations';
import { hasTooltipContent } from '../../data/itemCalculations';
import './ItemTable.css';

interface ItemTableProps {
  items: ItemRow[];
}

function TooltipPanel({ name, data }: { name: string; data: ItemTooltipData }) {
  const canCraftColor = data.done ? '#6f6' : data.craftableCount > 0 ? '#6f6' : '#f66';
  const usedBySorted = data.usedBy?.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  return (
    <div style={{
      maxWidth: 340,
      fontSize: 13,
      lineHeight: 1.5,
      overflowY: 'auto',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{name} ({data.count})</div>

      {data.note && (
        <div style={{ fontStyle: 'italic', color: '#bbb', marginBottom: 6 }}>{data.note}</div>
      )}

      {data.shops.length > 0 && (
          <div style={{ marginTop: data.recipe || data.usedBy.length > 0 || data.note ? 8 : 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Available at:</div>
            {data.shops.map((s, i) => {
              const packSuffix = s.qty > 1 ? ` ×${s.qty}` : '';
              const priceStr = s.currency === 'Qi Gem'
                  ? `${s.price.toLocaleString()} ✦${packSuffix}`
                  : s.currency
                      ? `${s.price.toLocaleString()} ${s.currency}${packSuffix}`
                      : `${s.price.toLocaleString()}g${packSuffix}`;
              const shopLabel = s.shop.startsWith('Festival ')
                  ? `🎪 ${s.shop.replace('Festival ', '').replace(/_/g, ' ')}`
                  : s.shop;
              return (
                  <div key={i} style={{ paddingLeft: 10, display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 12 }}>
                    <span style={{ color: '#ccc' }}>• {shopLabel}</span>
                    <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', color: s.currency === 'Qi Gem' ? '#c084fc' : s.currency ? '#f9a825' : '#86efac' }}>
                  {priceStr}
                </span>
                  </div>
              );
            })}
          </div>
      )}

      {data.recipe && (
        <div style={{ marginBottom: data.usedBy.length > 0 ? 8 : 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Recipe —{' '}
            <span style={{ color: canCraftColor }}>
              can craft: {data.craftableCount}
            </span>
          </div>
          {data.recipe.map(ing => {
            const isLimit = data.limitingIngredient === ing.name;
            return (
              <div key={ing.name} style={{ paddingLeft: 10, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span>• {ing.name} ×{ing.qty}</span>
                <span style={{ color: ing.done ? '#6f6' : '#f66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  have {ing.available}{isLimit ? ' ⚠' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {usedBySorted.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Used in:</div>
          {data.usedBy.map(dep => (
            <div key={dep.craftedName} style={{ paddingLeft: 10, marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span>• {dep.craftedName}</span>
                <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#aaa' }}>have {dep.alreadyHave}</span>
                  <span style={{ color: dep.done ? '#6f6' : dep.craftableCount > 0 ? '#6f6' : '#f66' }}>
                    +{dep.craftableCount}
                  </span>
                </span>
              </div>
              {dep.recipe.map(ing => (
                <div key={ing.name} style={{ paddingLeft: 14, display: 'flex', gap: 6, fontSize: 12, color: '#aaa' }}>
                  <span>{ing.name} ×{ing.qty}</span>
                  <span style={{ color: ing.done ? '#6d6' : '#d66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    have {ing.available}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!data.recipe && data.usedBy.length === 0 && !data.note && data.shops.length === 0 && (
        <div style={{ color: '#888' }}>No recipe or dependency info.</div>
      )}
    </div>
  );
}

function fmtNumber(n: string | number): string {
  if (n === 0) return '';
  return n.toLocaleString();
}

const COLUMNS: Array<{ key: string; label: string; minW: number }> = [
  { key: 'checkbox',    label: '✓',         minW: 20 },
  { key: 'percentage',  label: '%',         minW: 40 },
  { key: 'name',        label: 'Name',      minW: 60 },
  { key: 'required',    label: 'Required',  minW: 40 },
  { key: 'needed',      label: 'Needed',    minW: 40 },
  { key: 'total',       label: 'Total',     minW: 40 },
  { key: 'raw',         label: 'Raw',       minW: 40 },
  { key: 'gold_needed', label: '💰 Gold',   minW: 54 },
  { key: 'qi_needed',   label: '✦ Qi',      minW: 44 },
  { key: 'raw_I',       label: 'Ir',        minW: 36 },
  { key: 'raw_G',       label: 'G',         minW: 36 },
  { key: 'raw_S',       label: 'S',         minW: 36 },
  { key: 'raw_N',       label: 'N',         minW: 36 },
];
const QUALITY_KEYS = new Set(['raw_I', 'raw_G', 'raw_S', 'raw_N']);
const COST_KEYS = new Set(['gold_needed', 'qi_needed']);

export function ItemTable({ items }: ItemTableProps) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({
    checkbox: 30,
    percentage: 56,
    name: 200,
    required: 90,
    total: 90,
    needed: 90,
    raw: 80,
    gold_needed: 80,
    qi_needed: 64,
    raw_I: 54,
    raw_G: 54,
    raw_S: 54,
    raw_N: 54,
  });
  const [hover, setHover] = React.useState<{ name: string; data: ItemTooltipData; x: number; y: number } | null>(null);
  const theadRef = React.useRef<HTMLTableSectionElement>(null);
  const [theadHeight, setTheadHeight] = React.useState(34);

  React.useEffect(() => {
    if (!theadRef.current) return;
    const measure = () => {
      if (theadRef.current) {
        setTheadHeight(theadRef.current.offsetHeight);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(theadRef.current);
    return () => ro.disconnect();
  }, []);

  const handleResizeStart = (column: string, startX: number) => {
    const startWidth = columnWidths[column] ?? 40;
    const minW = COLUMNS.find(c => c.key === column)?.minW ?? 20;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [column]: Math.max(minW, startWidth + diff),
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  try {
    const categoryTotal = items.reduce((sum, item) => sum + item.raw, 0);
    const enrichedItems = enrichItemsWithCalculations(items, categoryTotal);
    const totalRequired = enrichedItems.reduce((sum, item) => sum + item.required, 0);
    const totalRaw = enrichedItems.reduce((sum, item) => sum + item.raw, 0);
    const totalUsed = enrichedItems.reduce((sum, item) => sum + item.total, 0);
    const cappedHave = enrichedItems.reduce((sum, item) => sum + Math.min(item.raw + item.total, item.required), 0);
    const totalGoldNeeded = enrichedItems.reduce((sum, item) => {
      const needed = Math.max(0, item.required - (item.raw + item.total));
      const bp = (item as unknown as ItemRow).buyPrice;
      return sum + (bp?.gold ? needed * bp.gold : 0);
    }, 0);
    const totalQiNeeded = enrichedItems.reduce((sum, item) => {
      const needed = Math.max(0, item.required - (item.raw + item.total));
      const bp = (item as unknown as ItemRow).buyPrice;
      return sum + (bp?.qiGem ? needed * bp.qiGem : 0);
    }, 0);
    const totalsRow: ItemWithCalculations = {
      name: 'Total',
      required: totalRequired,
      raw: totalRaw,
      total: totalUsed,
      percentage: totalRequired > 0 ? (cappedHave / totalRequired) * 100 : 0,
    };

    const tableData = [totalsRow, ...enrichedItems, totalsRow];

    const renderCell = (row: ItemWithCalculations, index: number, column: string): React.ReactNode => {
      const isTotal = index === 0 || index === tableData.length - 1;
      const done = !isTotal && row.percentage >= 100;
      switch (column) {
        case 'checkbox':   return isTotal ? '—' : (done ? '☑' : '☐');
        case 'percentage': return `${Math.floor(row.percentage)}%`;
        case 'name':       return isTotal ? 'Total' : row.name;
        case 'required':   return fmtNumber(row.required);
        case 'needed':     return fmtNumber(Math.max(0, row.required - (row.raw + row.total)));
        case 'total':      return fmtNumber(row.raw + row.total);
        case 'raw':        return fmtNumber(row.raw);
        case 'raw_N':      return fmtNumber(isTotal ? '' : (row.rawStacks?.[0] ?? 0));
        case 'raw_S':      return fmtNumber(isTotal ? '' : (row.rawStacks?.[1] ?? 0));
        case 'raw_G':      return fmtNumber(isTotal ? '' : (row.rawStacks?.[2] ?? 0));
        case 'raw_I':      return fmtNumber(isTotal ? '' : (row.rawStacks?.[4] ?? 0));
        case 'gold_needed': {
          if (isTotal) return fmtNumber(totalGoldNeeded);
          const needed = Math.max(0, row.required - (row.raw + row.total));
          const bp = (row as unknown as ItemRow).buyPrice;
          if (!bp?.gold || needed === 0) return '';
          return fmtNumber(needed * bp.gold);
        }
        case 'qi_needed': {
          if (isTotal) return fmtNumber(totalQiNeeded);
          const needed = Math.max(0, row.required - (row.raw + row.total));
          const bp = (row as unknown as ItemRow).buyPrice;
          if (!bp?.qiGem || needed === 0) return '';
          return fmtNumber(needed * bp.qiGem);
        }
        default:           return '';
      }
    };

    // Determine which quality tiers are actually used or needed
    const usedTiers = new Set<number>();
    const itemsWithQuality = enrichedItems.filter(item => item.rawStacks !== undefined);
    
    for (const item of itemsWithQuality) {
      [0, 1, 2, 4].forEach(tier => {
        if ((item.rawStacks![tier] ?? 0) > 0) usedTiers.add(tier);
      });
    }
    
    // If any item with quality has wrong quality, show both the tier they have and the tier they need
    // For cooking: if they have normal (0) but need gold (2), show both
    const hasWrongQualityItems = itemsWithQuality.some(item => (item as unknown as ItemRow).hasWrongQuality);
    if (hasWrongQualityItems) {
      if (usedTiers.has(0)) usedTiers.add(2); // If has normal, also show gold
      if (usedTiers.has(1)) usedTiers.add(4); // If has silver, also show iridium
    }
    
    // Only show quality columns if there are items with quality data
    const showQualityCols = itemsWithQuality.length > 0 && usedTiers.size > 0;

    const showGoldCol = enrichedItems.some(item => (item as unknown as ItemRow).buyPrice?.gold !== undefined);
    const showQiCol = enrichedItems.some(item => (item as unknown as ItemRow).buyPrice?.qiGem !== undefined);

    const visibleCols = COLUMNS.filter(c => {
      if (QUALITY_KEYS.has(c.key)) {
        if (!showQualityCols) return false;
        // Only show quality columns for tiers that are actually used or needed
        if (c.key === 'raw_N') return usedTiers.has(0);
        if (c.key === 'raw_S') return usedTiers.has(1);
        if (c.key === 'raw_G') return usedTiers.has(2);
        if (c.key === 'raw_I') return usedTiers.has(4);
        return false;
      }
      if (c.key === 'gold_needed') return showGoldCol;
      if (c.key === 'qi_needed') return showQiCol;
      return true;
    });
    const colW = (key: string): number => {
      const stored = columnWidths[key] ?? COLUMNS.find(c => c.key === key)?.minW ?? 40;
      if (key === 'gold_needed' && showGoldCol) {
        const needed = Math.ceil(fmtNumber(totalGoldNeeded).length * 8.5) + 16;
        return Math.max(stored, needed);
      }
      if (key === 'qi_needed' && showQiCol) {
        const needed = Math.ceil(fmtNumber(totalQiNeeded).length * 8.5) + 16;
        return Math.max(stored, needed);
      }
      return stored;
    };
    const tableWidth = visibleCols.reduce((s, c) => s + colW(c.key), 0);

    const thBase: React.CSSProperties = {
      border: `1px solid ${isDark ? '#555' : '#ccc'}`, padding: '4px 6px',
      color: isDark ? '#e0e0e0' : 'black', fontSize: '13px',
      backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', position: 'sticky',
      top: 'var(--sticky-top-offset, 0px)',
      zIndex: 3, whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'none',
    };

    return (
      <div style={{ width: '100%', border: `1px solid ${isDark ? '#555' : '#ccc'}`, padding: '10px' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: tableWidth }}>
          <thead ref={theadRef}>
            <tr>
              {visibleCols.map(col => (
                <th key={col.key} style={{ ...thBase, width: colW(col.key) }}>
                  {col.label}
                  <div
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
                    onMouseDown={(e) => { e.preventDefault(); handleResizeStart(col.key, e.clientX); }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => {
              const isTopTotal = index === 0;
              const isBottomTotal = index === tableData.length - 1;
              const isTotal = isTopTotal || isBottomTotal;
              const done = !isTotal && row.percentage >= 100;
              const rawTooltip = !isTotal ? (row as ItemRow & { percentage: number }).tooltip : undefined;
              const tooltipData = rawTooltip && hasTooltipContent(rawTooltip) ? rawTooltip : undefined;
              const itemRow = !isTotal ? (row as ItemRow & { percentage: number }) : undefined;
              const hasWrongQuality = itemRow?.hasWrongQuality ?? false;
              const hasUnfinishedDependents = itemRow?.hasUnfinishedDependents ?? false;
              // Check if at least one quality tier has a complete stack of 999
              const hasCompleteStack = !isTotal && (itemRow?.rawStacks?.some(count => count >= 999) ?? false);
              const rowBg = isTotal
                ? (isDark ? '#3a3a3a' : '#d0d0d0')
                : hasWrongQuality
                  ? (isDark ? '#1e3a4a' : '#b3e5fc') // light blue for wrong quality (takes priority)
                  : hasUnfinishedDependents
                    ? (isDark ? '#4a3a1e' : '#fff9c4') // yellow for unfinished dependents
                    : done && hasCompleteStack
                      ? (isDark ? '#1b4a1e' : '#c8e6c9') // green for done with complete stack
                      : (isDark ? 'transparent' : 'white');
              const stickyStyle: React.CSSProperties = isTopTotal
                ? { position: 'sticky', top: `calc(var(--sticky-top-offset, 0px) + ${theadHeight}px)`, zIndex: 2, backgroundColor: rowBg }
                : isBottomTotal
                ? { position: 'sticky', bottom: 'var(--sticky-bottom-offset, 0px)', zIndex: 2, backgroundColor: rowBg }
                : {};
              return (
                <tr
                  key={index}
                  style={{ backgroundColor: rowBg, fontWeight: isTotal ? 'bold' : 'normal', cursor: tooltipData ? 'help' : 'default' }}
                  onMouseEnter={tooltipData ? (e) => setHover({ name: row.name, data: tooltipData, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={tooltipData ? () => setHover(null) : undefined}
                >
                  {visibleCols.map(col => (
                    <td key={col.key} style={{
                      border: `1px solid ${isDark ? '#555' : '#ccc'}`, padding: '4px 6px', fontSize: '13px',
                      width: colW(col.key), maxWidth: colW(col.key),
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textAlign: col.key === 'checkbox' ? 'center' : COST_KEYS.has(col.key) ? 'right' : undefined,
                      color: col.key === 'gold_needed' ? (isDark ? '#ffd54f' : '#9a7000') : col.key === 'qi_needed' ? (isDark ? '#ce93d8' : '#8b44ac') : undefined,
                      ...stickyStyle,
                    }}>
                      {renderCell(row, index, col.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {hover && (() => {
          const tipW = 360;
          const margin = 8;
          const viewportW = document.documentElement.clientWidth;
          const viewportH = document.documentElement.clientHeight;
          let x = hover.x + 16;
          if (x + tipW > viewportW - margin) x = hover.x - tipW - margin;
          if (x < margin) x = margin;
          const maxTipH = viewportH * 0.6;
          let y = hover.y;
          if (y + maxTipH > viewportH - margin) {
            y = hover.y - 20;
          }
          if (y < margin) y = margin;
          if (y + maxTipH > viewportH - margin) y = viewportH - maxTipH - margin;
          return (
            <div
              onMouseEnter={() => setHover(hover)}
              onMouseLeave={() => setHover(null)}
              style={{
              position: 'fixed',
              left: x,
              top: y,
              zIndex: 9999,
              background: '#1e1e2e',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '10px 14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              color: '#ddd',
              minWidth: 220,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}>
              <TooltipPanel name={hover.name} data={hover.data} />
            </div>
          );
        })()}
      </div>
    );
  } catch (error) {
    return (
      <div style={{ color: 'red', border: '2px solid red', padding: '10px' }}>
        <h3>ERROR IN ITEMTABLE</h3>
        <p>{String(error)}</p>
      </div>
    );
  }
}
