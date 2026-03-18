import React, { useMemo } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { computeCategoryItems } from '../../data/itemCalculations';
import type { ItemRow } from '../../data/itemCalculations';
import { calculatePercentage } from '../../types/Item';

export const OVERVIEW_TAB = 'Overview';

interface OverviewProps {
  compacted: Array<{ name: string; stack: number; quality?: number[] }>;
  categoryNames: string[];
}

interface CategoryStat {
  name: string;
  total: number;
  done: number;
  pct: number;
}

function rowPct(row: ItemRow): number {
  return calculatePercentage({ name: row.name, required: row.required, total: row.total, raw: row.raw });
}

function buildCategoryStat(name: string, rows: ItemRow[]): CategoryStat {
  const total = rows.length;
  const done = rows.filter(r => r.raw + r.total >= r.required).length;
  const pct = total > 0 ? rows.reduce((s, r) => s + rowPct(r), 0) / total : 0;
  return { name, total, done, pct };
}

function fmtC(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function CircleStat({ value, max, label, fmt }: { value: number; max: number; label: string; fmt?: (n: number) => string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);
  const display = fmt ?? ((n: number) => n.toLocaleString());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <svg width="130" height="130" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ef5350" strokeWidth="9" />
        {pct > 0 && (
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="#4caf50"
            strokeWidth="9"
            strokeDasharray={String(circ)}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        )}
        <text x="50" y="47" textAnchor="middle" fontSize="17" fontWeight="bold" fill="currentColor">
          {Math.round(pct)}%
        </text>
        <text x="50" y="62" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">
          {display(value)} / {display(max)}
        </text>
      </svg>
      <Typography variant="body2" fontWeight={700} sx={{ textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Box>
  );
}

export function Overview({ compacted, categoryNames }: OverviewProps) {
  const validCategories = useMemo(
    () => categoryNames.filter(n => n !== 'asdf'),
    [categoryNames]
  );

  const categoryStatsData = useMemo(
    () =>
      validCategories
        .map(name => buildCategoryStat(name, computeCategoryItems(name, compacted)))
        .sort((a, b) => a.pct - b.pct),
    [validCategories, compacted]
  );

  const allRows = useMemo(() => computeCategoryItems('All', compacted), [compacted]);

  const { goldTotal, goldCovered, qiTotal, qiCovered } = useMemo(() => ({
    goldTotal:   allRows.reduce((s, r) => s + (r.buyPrice?.gold  ? r.required * r.buyPrice.gold  : 0), 0),
    goldCovered: allRows.reduce((s, r) => s + (r.buyPrice?.gold  ? Math.min(r.raw + r.total, r.required) * r.buyPrice.gold  : 0), 0),
    qiTotal:     allRows.reduce((s, r) => s + (r.buyPrice?.qiGem ? r.required * r.buyPrice.qiGem : 0), 0),
    qiCovered:   allRows.reduce((s, r) => s + (r.buyPrice?.qiGem ? Math.min(r.raw + r.total, r.required) * r.buyPrice.qiGem : 0), 0),
  }), [allRows]);

  const globalDone = allRows.filter(r => r.raw + r.total >= r.required).length;
  const globalTotal = allRows.length;
  const totalGathered = allRows.reduce((s, r) => s + r.raw + r.total, 0);
  const totalRequired = allRows.reduce((s, r) => s + r.required, 0);

  if (compacted.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
        <Typography variant="h6" gutterBottom>No save data loaded</Typography>
        <Typography variant="body2">Upload a save file to see your progress overview.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Category Breakdown
      </Typography>

      <Box
        component="table"
        sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
      >
        <Box component="thead">
          <Box component="tr" sx={{ borderBottom: '2px solid', borderColor: 'divider' }}>
            <Box component="th" sx={{ textAlign: 'left', py: 1, pr: 2, fontWeight: 700 }}>
              Category
            </Box>
            <Box component="th" sx={{ textAlign: 'center', py: 1, px: 1, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Done&nbsp;/&nbsp;Total
            </Box>
            <Box component="th" sx={{ py: 1, px: 1, fontWeight: 700, width: '50%' }}>
              Progress
            </Box>
            <Box component="th" sx={{ textAlign: 'right', py: 1, pl: 2, fontWeight: 700 }}>
              %
            </Box>
          </Box>
        </Box>
        <Box component="tbody">
          {categoryStatsData.map(stat => (
            <Box
              key={stat.name}
              component="tr"
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box component="td" sx={{ py: 0.75, pr: 2, fontWeight: stat.done === stat.total && stat.total > 0 ? 700 : 400 }}>
                {stat.name}
              </Box>
              <Box component="td" sx={{ textAlign: 'center', py: 0.75, px: 1, color: 'text.secondary', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {stat.done}&nbsp;/&nbsp;{stat.total}
              </Box>
              <Box component="td" sx={{ py: 0.75, px: 1 }}>
                <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.selected', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 4,
                      width: `${Math.min(stat.pct, 100)}%`,
                      bgcolor:
                        stat.pct >= 100 ? 'success.main' :
                        stat.pct >= 66 ? 'warning.light' :
                        stat.pct >= 33 ? 'warning.main' :
                        'error.main',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </Box>
              </Box>
              <Box
                component="td"
                sx={{
                  textAlign: 'right',
                  py: 0.75,
                  pl: 2,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: stat.pct >= 100 ? 'success.main' : 'text.primary',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              >
                {stat.pct.toFixed(1)}%
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Overall Statistics
      </Typography>
      <Box sx={{ display: 'flex', gap: { xs: 3, sm: 6 }, flexWrap: 'wrap', justifyContent: 'center', pb: 2 }}>
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
