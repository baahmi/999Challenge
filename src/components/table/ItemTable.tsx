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
            const ok = ing.available >= ing.qty;
            return (
              <div key={ing.name} style={{ paddingLeft: 10, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span>• {ing.name} ×{ing.qty}</span>
                <span style={{ color: ok ? '#6f6' : '#f66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
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
              {dep.recipe.map(ing => {
                const ok = ing.available >= ing.qty;
                return (
                  <div key={ing.name} style={{ paddingLeft: 14, display: 'flex', gap: 6, fontSize: 12, color: '#aaa' }}>
                    <span>{ing.name} ×{ing.qty}</span>
                    <span style={{ color: ok ? '#6d6' : '#d66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      have {ing.available}
                    </span>
                  </div>
                );
              })}
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

export function ItemTable({ items }: ItemTableProps) {
  const [columnWidths, setColumnWidths] = React.useState({
    percentage: 80,
    name: 150,
    required: 100,
    total: 100,
    raw: 100,
  });
  const [hover, setHover] = React.useState<{ name: string; data: ItemTooltipData; x: number; y: number } | null>(null);

  const handleResizeStart = (column: keyof typeof columnWidths, startX: number) => {
    const startWidth = columnWidths[column];

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [column]: Math.max(50, startWidth + diff),
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
    const totalsRow: ItemWithCalculations = {
      name: 'Total',
      required: totalRequired,
      raw: totalRaw,
      total: totalUsed,
      percentage: (totalRaw + totalUsed) >= totalRequired ? 100 : ((totalRaw + totalUsed) / totalRequired) * 100,
    };

    const tableData = [totalsRow, ...enrichedItems, totalsRow];

    const renderCell = (row: ItemWithCalculations, index: number, column: keyof typeof columnWidths): React.ReactNode => {
      const isTotal = index === 0 || index === tableData.length - 1;
      const done = !isTotal && row.percentage >= 100;
      
      switch (column) {
        case 'percentage':
          return `${Math.floor(row.percentage)}%`;
        case 'name':
          return isTotal ? 'Total' : (
            <span style={done ? { color: '#4caf50', fontWeight: 600 } : undefined}>{row.name}</span>
          );
        case 'required':
          return row.required;
        case 'total':
          return row.total;
        case 'raw':
          return row.raw;
        default:
          return '';
      }
    };

    return (
      <div style={{ width: '100%', border: '1px solid #ccc', padding: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ccc', padding: '4px', color: 'black', fontSize: '14px' }}>%</th>
              <th style={{ border: '1px solid #ccc', padding: '4px', color: 'black', fontSize: '14px' }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: '4px', color: 'black', fontSize: '14px' }}>Required</th>
              <th style={{ border: '1px solid #ccc', padding: '4px', color: 'black', fontSize: '14px' }}>Total</th>
              <th style={{ border: '1px solid #ccc', padding: '4px', color: 'black', fontSize: '14px' }}>Raw</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => {
              const isTotal = index === 0 || index === tableData.length - 1;
              const tooltipData = !isTotal ? (row as ItemRow & { percentage: number }).tooltip : undefined;
              return (
                <tr
                  key={index}
                  style={{ backgroundColor: isTotal ? '#d0d0d0' : 'white', fontWeight: isTotal ? 'bold' : 'normal', cursor: tooltipData ? 'help' : 'default' }}
                  onMouseEnter={tooltipData ? (e) => setHover({ name: row.name, data: tooltipData, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={tooltipData ? () => setHover(null) : undefined}
                >
                  <td style={{ border: '1px solid #ccc', padding: '4px', minWidth: '40px' }}>
                    {renderCell(row, index, 'percentage')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', minWidth: '50px' }}>
                    {renderCell(row, index, 'name')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', minWidth: '10px' }}>
                    {renderCell(row, index, 'required')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', minWidth: '10px' }}>
                    {renderCell(row, index, 'total')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', minWidth: '10px' }}>
                    {renderCell(row, index, 'raw')}
                  </td>
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
