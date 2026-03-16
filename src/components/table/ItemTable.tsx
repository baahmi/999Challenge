import React from 'react';
import { enrichItemsWithCalculations } from '../../types/Item';
import type { ItemWithCalculations } from '../../types/Item';
import type { ItemRow, ItemTooltipData } from '../../data/itemCalculations';
import './ItemTable.css';

interface ItemTableProps {
  items: ItemRow[];
}

function TooltipPanel({ name, data }: { name: string; data: ItemTooltipData }) {
  const canCraftColor = data.craftableCount > 0 ? '#6f6' : '#f66';
  return (
    <div style={{
      maxWidth: 340,
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{name}</div>

      {data.note && (
        <div style={{ fontStyle: 'italic', color: '#bbb', marginBottom: 6 }}>{data.note}</div>
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

      {data.usedBy.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Used in:</div>
          {data.usedBy.map(dep => (
            <div key={dep.craftedName} style={{ paddingLeft: 10, marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span>• {dep.craftedName}</span>
                <span style={{ color: dep.craftableCount > 0 ? '#6f6' : '#f66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  can make: {dep.craftableCount}
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

      {!data.recipe && data.usedBy.length === 0 && !data.note && (
        <div style={{ color: '#888' }}>No recipe or dependency info.</div>
      )}
    </div>
  );
}

const COLUMNS: Array<{ key: string; label: string; minW: number }> = [
  { key: 'checkbox',   label: '✓',        minW: 20 },
  { key: 'percentage', label: '%',         minW: 40 },
  { key: 'name',       label: 'Name',      minW: 60 },
  { key: 'required',   label: 'Required',  minW: 40 },
  { key: 'total',      label: 'Total',     minW: 40 },
  { key: 'raw',        label: 'Raw',       minW: 40 },
  { key: 'raw_I',      label: 'Ir',        minW: 36 },
  { key: 'raw_G',      label: 'G',         minW: 36 },
  { key: 'raw_S',      label: 'S',         minW: 36 },
  { key: 'raw_N',      label: 'N',         minW: 36 },
];
const QUALITY_KEYS = new Set(['raw_I', 'raw_G', 'raw_S', 'raw_N']);

export function ItemTable({ items }: ItemTableProps) {
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({
    checkbox: 30,
    percentage: 56,
    name: 200,
    required: 90,
    total: 90,
    raw: 80,
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
        case 'required':   return row.required;
        case 'total':      return row.raw + row.total;
        case 'raw':        return row.raw;
        case 'raw_N':      return isTotal ? '' : (row.rawStacks?.[0] ?? 0);
        case 'raw_S':      return isTotal ? '' : (row.rawStacks?.[1] ?? 0);
        case 'raw_G':      return isTotal ? '' : (row.rawStacks?.[2] ?? 0);
        case 'raw_I':      return isTotal ? '' : (row.rawStacks?.[4] ?? 0);
        default:           return '';
      }
    };

    // Hide quality columns when every item with stock has exactly one tier, same across all
    const showQualityCols = (() => {
      let singleTier: number | undefined;
      for (const item of enrichedItems) {
        if (!item.rawStacks) return false;
        const tiers = [0, 1, 2, 4].filter(i => (item.rawStacks![i] ?? 0) > 0);
        if (tiers.length === 0) continue;
        if (tiers.length > 1) return true;
        const tier = tiers[0]!;
        if (singleTier === undefined) singleTier = tier;
        else if (singleTier !== tier) return true;
      }
      return false;
    })();

    const visibleCols = COLUMNS.filter(c => !QUALITY_KEYS.has(c.key) || showQualityCols);
    const tableWidth = visibleCols.reduce((s, c) => s + (columnWidths[c.key] ?? c.minW), 0);

    const thBase: React.CSSProperties = {
      border: '1px solid #ccc', padding: '4px 6px', color: 'black', fontSize: '13px',
      backgroundColor: '#f0f0f0', position: 'sticky', top: 'var(--sticky-top-offset, 0px)',
      zIndex: 3, whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'none',
    };

    return (
      <div style={{ width: '100%', border: '1px solid #ccc', padding: '10px' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: tableWidth }}>
          <thead ref={theadRef}>
            <tr>
              {visibleCols.map(col => (
                <th key={col.key} style={{ ...thBase, width: columnWidths[col.key] }}>
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
              const tooltipData = !isTotal ? (row as ItemRow & { percentage: number }).tooltip : undefined;
              const rowBg = isTotal ? '#d0d0d0' : done ? '#c8e6c9' : 'white';
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
                      border: '1px solid #ccc', padding: '4px 6px', fontSize: '13px',
                      width: columnWidths[col.key], maxWidth: columnWidths[col.key],
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textAlign: col.key === 'checkbox' ? 'center' : undefined,
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
          const tipH = 220;
          const x = hover.x + 16 + tipW > window.innerWidth ? hover.x - tipW - 8 : hover.x + 16;
          const y = hover.y + 16 + tipH > window.innerHeight ? hover.y - tipH - 8 : hover.y + 16;
          return (
            <div style={{
              position: 'fixed',
              left: x,
              top: y,
              zIndex: 9999,
              background: '#1e1e2e',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '10px 14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              color: '#ddd',
              minWidth: 220,
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
