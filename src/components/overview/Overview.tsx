import React, { useMemo } from 'react';
import { Box, Typography, Divider, useColorScheme } from '@mui/material';
import { computeCategoryItems } from '../../data/itemCalculations';
import type { ItemRow } from '../../data/itemCalculations';
import { calculateObtainedCount, calculatePercentage } from '../../types/Item';

export const OVERVIEW_TAB = 'Overview';

interface OverviewProps {
  compacted: Array<{ name: string; stack: number; quality?: number[] }>;
  categoryNames: string[];
  onCategorySelect?: (category: string) => void;
}

interface CategoryStat {
  name: string;
  itemCount: number;
  readyCount: number;
  required: number;
  total: number;
  goldNeeded: number;
  qiNeeded: number;
  pct: number;
}

function rowPct(row: ItemRow): number {
  return calculatePercentage({
    name: row.name,
    required: row.required,
    total: row.total,
    raw: row.raw,
    hasWrongQuality: row.hasWrongQuality,
    correctQualityCount: row.correctQualityCount,
  });
}

function effectiveRowTotal(row: ItemRow): number {
  return calculateObtainedCount(row);
}

function buildCategoryStat(name: string, rows: ItemRow[]): CategoryStat {
  const itemCount = rows.length;
  const readyCount = rows.filter(r => rowPct(r) >= 100).length;
  const required = rows.reduce((s, r) => s + r.required, 0);
  const total = rows.reduce((s, r) => s + (r.excludeFromTotals ? 0 : r.raw + r.total), 0);
  const effectiveTotal = rows.reduce((s, r) => s + Math.min(effectiveRowTotal(r), r.required), 0);
  const goldNeeded = rows.reduce((s, r) => {
    const needed = Math.max(0, r.required - Math.min(effectiveRowTotal(r), r.required));
    return s + (r.buyPrice?.gold ? needed * r.buyPrice.gold : 0);
  }, 0);
  const qiNeeded = rows.reduce((s, r) => {
    const needed = Math.max(0, r.required - Math.min(effectiveRowTotal(r), r.required));
    return s + (r.buyPrice?.qiGem ? needed * r.buyPrice.qiGem : 0);
  }, 0);
  const pct = required > 0 ? (effectiveTotal / required) * 100 : 0;
  return { name, itemCount, readyCount, required, total, goldNeeded, qiNeeded, pct };
}

function getProgressRowBackground(pct: number, isDark: boolean, baseColor?: string) {
  const progress = Math.max(0, Math.min(100, pct));
  const fillColor = isDark ? 'rgba(102, 187, 106, 0.34)' : 'rgba(102, 187, 106, 0.28)';
  return {
    backgroundColor: baseColor,
    backgroundImage: progress > 0
      ? `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${progress}%, transparent ${progress}%, transparent 100%)`
      : undefined,
  };
}

function fmtC(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function CircleStat({ value, max, label, fmt }: { value: number; max: number; label: string; fmt?: (n: number) => string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 76;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);
  const display = fmt ?? ((n: number) => n.toLocaleString());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: 310 }}>
      <svg width="310" height="260" viewBox="0 0 230 190">
        <circle cx="115" cy="95" r={r} fill="none" stroke="#ef5350" strokeWidth="12" />
        {pct > 0 && (
          <circle
            cx="115" cy="95" r={r}
            fill="none"
            stroke="#4caf50"
            strokeWidth="12"
            strokeDasharray={String(circ)}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 115 95)"
          />
        )}
        <text x="115" y="88" textAnchor="middle" dominantBaseline="middle" fontSize="25" fontWeight="bold" fill="currentColor">
          {Math.round(pct)}%
        </text>
        <text x="115" y="111" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="currentColor" opacity="0.72">
          {display(value)} / {display(max)}
        </text>
      </svg>
      <Typography variant="body2" fontWeight={700} sx={{ textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Box>
  );
}

export function Overview({ compacted, categoryNames, onCategorySelect }: OverviewProps) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  
  const validCategories = useMemo(
    () => categoryNames.filter(n => n !== 'asdf'),
    [categoryNames]
  );

  const { categoryStatsData, allRows, totalStat } = useMemo(() => {
    if (compacted.length === 0) return;

    const stats: CategoryStat[] = [];
    for (const name of validCategories) {
      stats.push(buildCategoryStat(name, computeCategoryItems(name, compacted)));
    }
    const all = computeCategoryItems('All', compacted);
    return {
      categoryStatsData: stats,
      allRows: all,
      totalStat: buildCategoryStat('Total', all),
    };
  }, [validCategories, compacted]) ?? { categoryStatsData: [], allRows: [], totalStat: buildCategoryStat('Total', []) };

  const { goldTotal, goldCovered, qiTotal, qiCovered } = useMemo(() => ({
    goldTotal:   allRows.reduce((s, r) => s + (r.buyPrice?.gold  ? r.required * r.buyPrice.gold  : 0), 0),
    goldCovered: allRows.reduce((s, r) => s + (r.buyPrice?.gold  ? Math.min(effectiveRowTotal(r), r.required) * r.buyPrice.gold  : 0), 0),
    qiTotal:     allRows.reduce((s, r) => s + (r.buyPrice?.qiGem ? r.required * r.buyPrice.qiGem : 0), 0),
    qiCovered:   allRows.reduce((s, r) => s + (r.buyPrice?.qiGem ? Math.min(effectiveRowTotal(r), r.required) * r.buyPrice.qiGem : 0), 0),
  }), [allRows]);

  const globalDone = allRows.filter(r => rowPct(r) >= 100).length;
  const globalTotal = allRows.length;
  const totalGathered = allRows.reduce((s, r) => s + Math.min(effectiveRowTotal(r), r.required), 0);
  const totalRequired = allRows.reduce((s, r) => s + r.required, 0);

  if (compacted.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
        <Typography variant="h6" gutterBottom>No save data loaded</Typography>
        <Typography variant="body2">Upload a save file to see your progress overview.</Typography>
      </Box>
    );
  }

  const tableRows = [totalStat, ...categoryStatsData, totalStat];
  const borderColor = isDark ? '#555' : '#ccc';
  const headerBg = isDark ? '#2a2a2a' : '#f0f0f0';
  const totalBg = isDark ? '#3a3a3a' : '#d0d0d0';
  const cellSx = {
    border: `1px solid ${borderColor}`,
    py: 0.5,
    px: 0.75,
    fontSize: '13px',
    whiteSpace: 'nowrap',
  };
  const numberCellSx = {
    ...cellSx,
    textAlign: 'right',
    fontFamily: 'monospace',
  };

  return (
    <Box sx={{ width: '100%', border: `1px solid ${borderColor}`, p: '10px' }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Overview
      </Typography>

      <Box
        component="table"
        sx={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}
      >
        <thead>
          <tr>
            {['Category', '% Ready', 'Items', 'Ready', 'Required', 'Total', '💰 Gold needed', '✦ Qi needed'].map((label) => (
              <Box
                key={label}
                component="th"
                sx={{
                  ...cellSx,
                  textAlign: label === 'Category' ? 'left' : 'right',
                  fontWeight: 700,
                  color: isDark ? '#e0e0e0' : 'black',
                  backgroundColor: headerBg,
                }}
              >
                {label}
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((stat, index) => {
            const isTotal = index === 0 || index === tableRows.length - 1;
            const rowBackground = getProgressRowBackground(stat.pct, isDark, isTotal ? totalBg : undefined);
            const canSelect = !isTotal && onCategorySelect !== undefined;
            return (
            <Box
              key={`${stat.name}-${index}`}
              component="tr"
              role={canSelect ? 'button' : undefined}
              tabIndex={canSelect ? 0 : undefined}
              onClick={canSelect ? () => onCategorySelect(stat.name) : undefined}
              onKeyDown={canSelect ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onCategorySelect(stat.name);
                }
              } : undefined}
              sx={{
                ...rowBackground,
                cursor: canSelect ? 'pointer' : undefined,
                '&:hover': {
                  filter: 'brightness(1.06)',
                },
                '&:focus-visible': canSelect ? {
                  outline: `2px solid ${isDark ? '#90caf9' : '#1976d2'}`,
                  outlineOffset: '-2px',
                } : undefined,
              }}
            >
              <Box component="td" sx={{ ...cellSx, fontWeight: isTotal ? 700 : 400 }}>
                {stat.name}
              </Box>
              <Box component="td" sx={{ ...numberCellSx, fontWeight: isTotal ? 700 : 600, color: stat.pct >= 100 ? 'success.main' : undefined }}>
                {stat.pct.toFixed(1)}%
              </Box>
              <Box component="td" sx={numberCellSx}>
                {stat.itemCount.toLocaleString()}
              </Box>
              <Box component="td" sx={numberCellSx}>
                {stat.readyCount.toLocaleString()}
              </Box>
              <Box component="td" sx={numberCellSx}>
                {Math.round(stat.required).toLocaleString()}
              </Box>
              <Box component="td" sx={numberCellSx}>
                {Math.round(stat.total).toLocaleString()}
              </Box>
              <Box component="td" sx={{ ...numberCellSx, color: isDark ? '#ffd54f' : '#9a7000' }}>
                {Math.round(stat.goldNeeded).toLocaleString()}
              </Box>
              <Box component="td" sx={{ ...numberCellSx, color: isDark ? '#ce93d8' : '#8b44ac' }}>
                {Math.round(stat.qiNeeded).toLocaleString()}
              </Box>
            </Box>
            );
          })}
        </tbody>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Overall Statistics
      </Typography>
      <Box sx={{ display: 'flex', gap: { xs: 3, sm: 4 }, flexWrap: 'wrap', justifyContent: 'flex-start', pb: 2 }}>
        <CircleStat
          value={globalDone}
          max={globalTotal}
          label="Stacks Completed"
        />
        <CircleStat
          value={totalGathered}
          max={totalRequired}
          label="Items Gathered"
        />
        {goldTotal > 0 && (
          <CircleStat
            value={goldCovered}
            max={goldTotal}
            label="💰 Gold Covered"
            fmt={fmtC}
          />
        )}
        {qiTotal > 0 && (
          <CircleStat
            value={qiCovered}
            max={qiTotal}
            label="✦ Qi Gems Covered"
            fmt={fmtC}
          />
        )}
      </Box>

      {(goldTotal > 0 || qiTotal > 0) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
            Buying Costs Remaining
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 3, sm: 6 }, flexWrap: 'wrap' }}>
            {goldTotal > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary">💰 Gold still needed</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: '#9a7000', fontFamily: 'monospace' }}>
                  {(goldTotal - goldCovered).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {goldTotal.toLocaleString()} total
                </Typography>
              </Box>
            )}
            {qiTotal > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary">✦ Qi Gems still needed</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: '#8b44ac', fontFamily: 'monospace' }}>
                  {(qiTotal - qiCovered).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {qiTotal.toLocaleString()} total
                </Typography>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
