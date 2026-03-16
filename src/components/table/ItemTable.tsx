import React, { useMemo } from 'react';
import { enrichItemsWithCalculations } from '../../types/Item';
import type { ItemWithCalculations } from '../../types/Item';
import './ItemTable.css';

interface ItemTableProps {
  items: { name: string; required: number; raw: number }[];
}

export function ItemTable({ items }: ItemTableProps) {
  const [columnWidths, setColumnWidths] = React.useState({
    percentage: 80,
    name: 150,
    required: 100,
    total: 100,
    raw: 100,
  });

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
    const totalsRow: ItemWithCalculations = {
      name: 'Total',
      required: totalRequired,
      raw: totalRaw,
      total: totalRaw,
      percentage: totalRaw >= totalRequired ? 100 : (totalRaw / totalRequired) * 100,
    };

    const tableData = [totalsRow, ...enrichedItems, totalsRow];

    const renderCell = (row: ItemWithCalculations, index: number, column: keyof typeof columnWidths) => {
      const isTotal = index === 0 || index === tableData.length - 1;
      
      switch (column) {
        case 'percentage':
          return `${Math.floor(row.percentage)}%`;
        case 'name':
          return isTotal ? 'Total' : row.name;
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
              return (
                <tr key={index} style={{ backgroundColor: isTotal ? '#d0d0d0' : 'white', fontWeight: isTotal ? 'bold' : 'normal' }}>
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
