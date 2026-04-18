import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Autocomplete, TextField,
} from '@mui/material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Tab } from '@mui/material';
import { useColorScheme } from '@mui/material';
import { JournalStore } from '../../app/Journal';
import type { Journal } from '../../app/Journal';
import { CustomDataStore } from '../../data/CustomDataStore';
import { computeCategoryItemsUncached } from '../../data/itemCalculations';
import { Config } from '../../config/Config';

export interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  journal: Journal | null;
}

interface DataPoint { x: number; y: number; }
interface ChartSeries { label: string; color: string; data: DataPoint[]; }

const PALETTE = ['#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#f43f5e', '#facc15', '#2dd4bf', '#fb923c'];

function niceYTicks(max: number, n = 5): number[] {
  if (max <= 0) return Array.from({ length: n + 1 }, (_, i) => i * 20);
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / mag) * mag;
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

function LineChart({
  series,
  xFormatter = (v: number) => `Day ${v}`,
  yFormatter = (v: number) => String(Math.round(v)),
}: {
  series: ChartSeries[];
  xFormatter?: (v: number) => string;
  yFormatter?: (v: number) => string;
}) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const allX = useMemo(() => {
    const xs = new Set<number>();
    for (const s of series) for (const d of s.data) xs.add(d.x);
    return Array.from(xs).sort((a, b) => a - b);
  }, [series]);

  if (series.length === 0 || allX.length === 0) {
    return (
      <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        No data available
      </Box>
    );
  }

  const maxY = Math.max(...series.flatMap(s => s.data.map(d => d.y)), 0);
  const yTicks = niceYTicks(maxY);
  const yMax = yTicks[yTicks.length - 1] ?? maxY;

  const PAD = { top: 15, right: 25, bottom: 38, left: 62 };
  const W = 580; const H = 240;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const xFirst = allX[0] ?? 0;
  const xLast = allX[allX.length - 1] ?? 0;
  const xPos = (x: number) =>
    allX.length === 1 ? PAD.left + cW / 2
      : PAD.left + ((x - xFirst) / (xLast - xFirst)) * cW;

  const yPos = (y: number) =>
    yMax === 0 ? PAD.top + cH : PAD.top + cH - (y / yMax) * cH;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < allX.length; i++) {
      const xi = allX[i] ?? 0;
      const dist = Math.abs(xPos(xi) - svgX);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setHoverIdx(best);
  };

  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const axisColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  const textColor = isDark ? '#999' : '#666';
  const hX: number | null = hoverIdx !== null ? (allX[hoverIdx] ?? null) : null;
  const xStep = Math.max(1, Math.ceil(allX.length / 10));

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)}
              stroke={gridColor} strokeWidth={0.75} />
            <text x={PAD.left - 6} y={yPos(v)} textAnchor="end" dominantBaseline="middle"
              fontSize={10} fill={textColor}>{yFormatter(v)}</text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top + cH} x2={W - PAD.right} y2={PAD.top + cH}
          stroke={axisColor} strokeWidth={1} />
        {allX.map((x, i) => {
          if (i % xStep !== 0 && i !== allX.length - 1) return null;
          return (
            <text key={x} x={xPos(x)} y={H - PAD.bottom + 14} textAnchor="middle"
              fontSize={10} fill={textColor}>{xFormatter(x)}</text>
          );
        })}
        {series.map(s => {
          const pts = [...s.data].sort((a, b) => a.x - b.x)
            .map(d => `${xPos(d.x)},${yPos(d.y)}`).join(' ');
          return <polyline key={s.label} points={pts} fill="none" stroke={s.color}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {series.map(s => s.data.map(d => (
          <circle key={`${s.label}-${d.x}`} cx={xPos(d.x)} cy={yPos(d.y)}
            r={hX === d.x ? 0 : 3} fill={s.color} />
        )))}
        {hX !== null && (
          <line x1={xPos(hX)} y1={PAD.top} x2={xPos(hX)} y2={PAD.top + cH}
            stroke={axisColor} strokeWidth={1} strokeDasharray="3 2" />
        )}
        {hX !== null && series.map(s => {
          const d = s.data.find(p => p.x === hX);
          if (!d) return null;
          return <circle key={s.label} cx={xPos(d.x)} cy={yPos(d.y)}
            r={4.5} fill={s.color} stroke={isDark ? '#222' : '#fff'} strokeWidth={1.5} />;
        })}
      </svg>
      {hX !== null && (() => {
        const pct = (xPos(hX) / W) * 100;
        return (
          <Box sx={{
            position: 'absolute', top: 16,
            left: `${pct}%`,
            transform: pct > 62 ? 'translateX(-108%)' : 'translateX(4%)',
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
            borderRadius: 1, p: '5px 10px', pointerEvents: 'none', zIndex: 10, boxShadow: 3,
          }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.25}>
              {xFormatter(hX)}
            </Typography>
            {series.map(s => {
              const d = s.data.find(p => p.x === hX);
              return (
                <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  <Typography variant="caption">
                    {series.length > 1 ? `${s.label}: ` : ''}
                    <strong>{d ? yFormatter(d.y) : '—'}</strong>
                  </Typography>
                </Box>
              );
            })}
          </Box>
        );
      })()}
      {series.length > 1 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
          {series.map(s => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 3, bgcolor: s.color, borderRadius: 1 }} />
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function HistoryDialog({ open, onClose, journal }: HistoryDialogProps) {
  const [tab, setTab] = useState('item');
  const [selectedItem, setSelectedItem] = useState('');
  const [itemSeries, setItemSeries] = useState<ChartSeries[]>([]);
  const [progressSeries, setProgressSeries] = useState<ChartSeries[]>([]);

  const availableDays = useMemo(() => {
    if (!journal) return [];
    return Object.keys(journal.days).map(Number).sort((a, b) => a - b);
  }, [journal]);

  const allItems = useMemo(
    () => [...new Set(CustomDataStore.getItemsData().map((itemEntry) => itemEntry.name))].sort(),
    []
  );

  useEffect(() => {
    if (!open || !journal || !selectedItem) {
      setItemSeries([]);
      return;
    }
    const days = Object.keys(journal.days).map(Number).sort((a, b) => a - b);
    if (days.length === 0) {
      setItemSeries([]);
      return;
    }
    const data = days.map(day => {
      const items = JournalStore.reconstructItemsAtDay(journal, day);
      const compacted = JournalStore.toCompactedItems(items, Config.getIgnoredCategories());
      const row = computeCategoryItemsUncached('All', compacted).find(r => r.name === selectedItem);
      return { x: day, y: row ? row.raw + row.total : 0 };
    });
    setItemSeries([{ label: selectedItem, color: PALETTE[0]!, data }]);
  }, [open, journal, selectedItem]);

  useEffect(() => {
    // Only compute when the progress tab is actually visible
    if (!open || !journal || tab !== 'progress') {
      setProgressSeries([]);
      return;
    }
    const days = Object.keys(journal.days).map(Number).sort((a, b) => a - b);
    if (days.length === 0) {
      setProgressSeries([]);
      return;
    }
    const cats = Config.getCategoryNames();
    const ignored = Config.getIgnoredCategories();
    const data = days.map(day => {
      const items = JournalStore.reconstructItemsAtDay(journal, day);
      const compacted = JournalStore.toCompactedItems(items, ignored);
      let totalHave = 0, totalRequired = 0;
      for (const cat of cats) {
        for (const row of computeCategoryItemsUncached(cat, compacted)) {
          totalRequired += row.required;
          totalHave += Math.min(row.raw + row.total, row.required);
        }
      }
      return { x: day, y: totalRequired > 0 ? Math.round((totalHave / totalRequired) * 10000) / 100 : 0 };
    });
    setProgressSeries([{ label: 'Overall', color: PALETTE[0]!, data }]);
  }, [open, journal, tab]);

  if (!journal || availableDays.length === 0) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>History</DialogTitle>
      <DialogContent>
        <TabContext value={tab}>
          <TabList onChange={(_, v: string) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label="Item" value="item" />
            <Tab label="Overall Progress" value="progress" />
          </TabList>
          <TabPanel value="item" sx={{ p: 0 }}>
            <Autocomplete
              size="small"
              sx={{ mb: 2, width: 300 }}
              options={allItems}
              value={selectedItem || null}
              onChange={(_, v) => setSelectedItem(v ?? '')}
              renderInput={params => <TextField {...params} label="Search item" />}
            />
            {selectedItem
              ? <LineChart series={itemSeries} />
              : <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                  Select an item above to view its history
                </Box>
            }
          </TabPanel>
          <TabPanel value="progress" sx={{ p: 0 }}>
            <LineChart series={progressSeries} yFormatter={v => `${v}%`} />
          </TabPanel>
        </TabContext>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
