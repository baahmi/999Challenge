import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, InputAdornment, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useColorScheme } from '@mui/material';
import type { Journal } from '../../app/Journal';

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
  stats: Record<string, string>;
  journal: Journal | null;
}

function numVal(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function StatsDialog({ open, onClose, stats, journal }: StatsDialogProps) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const availableDays = useMemo(() => {
    if (!journal) return [];
    return Object.keys(journal.days)
      .map(Number)
      .filter(d => !!journal.days[String(d)]?.stats)
      .sort((a, b) => a - b);
  }, [journal]);

  useEffect(() => {
    if (!open) return;
    if (availableDays.length > 0) {
      setSelectedDay(availableDays[availableDays.length - 1]!);
    } else {
      setSelectedDay(0);
    }
  }, [open, availableDays]);

  const activeStats: Record<string, string> = useMemo(() => {
    if (selectedDay > 0 && journal) {
      return journal.days[String(selectedDay)]?.stats ?? stats;
    }
    return stats;
  }, [selectedDay, journal, stats]);

  const prevStats: Record<string, string> | null = useMemo(() => {
    if (!journal || availableDays.length < 2) return null;
    const idx = availableDays.indexOf(selectedDay);
    if (idx <= 0) return null;
    const prevDay = availableDays[idx - 1]!;
    return journal.days[String(prevDay)]?.stats ?? null;
  }, [selectedDay, journal, availableDays]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(activeStats)
      .filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
      .sort(([, a], [, b]) => {
        const na = numVal(a), nb = numVal(b);
        if (na !== null && nb !== null) return nb - na;
        if (na !== null) return -1;
        if (nb !== null) return 1;
        return a.localeCompare(b);
      });
  }, [activeStats, search]);

  const borderColor = isDark ? '#555' : '#ddd';
  const headerBg = isDark ? '#2a2a2a' : '#f0f0f0';
  const altBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Player Statistics</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 0.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            sx={{ flex: 1, minWidth: 180 }}
            placeholder="Search stat name or value…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {availableDays.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Session</InputLabel>
              <Select
                label="Session"
                value={selectedDay}
                onChange={e => setSelectedDay(Number(e.target.value))}
              >
                {availableDays.map(d => (
                  <MenuItem key={d} value={d}>Day {d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {Object.keys(activeStats).length === 0 ? 'No save file loaded yet.' : 'No matching stats.'}
          </Typography>
        ) : (
          <Box sx={{ border: `1px solid ${borderColor}`, borderRadius: 1, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: headerBg }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>Stat</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: `1px solid ${borderColor}`, fontWeight: 600, width: 100 }}>Value</th>
                  {prevStats && <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: `1px solid ${borderColor}`, fontWeight: 600, width: 80, color: isDark ? '#aaa' : '#666' }}>Δ</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, value], i) => {
                  const n = numVal(value);
                  const formatted = n !== null ? n.toLocaleString() : value;
                  const prevVal = prevStats?.[key];
                  const delta = prevVal !== undefined && n !== null ? n - (numVal(prevVal) ?? n) : null;
                  return (
                    <tr key={key} style={{ backgroundColor: i % 2 === 1 ? altBg : 'transparent' }}>
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: 12 }}>{key}</td>
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatted}</td>
                      {prevStats && (
                        <td style={{
                          padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                          color: delta === null ? undefined : delta > 0 ? (isDark ? '#4ade80' : '#2e7d32') : delta < 0 ? (isDark ? '#f87171' : '#c62828') : (isDark ? '#888' : '#aaa'),
                          fontSize: 12,
                        }}>
                          {delta === null ? '—' : delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {rows.length} / {Object.keys(activeStats).length} stats
          {prevStats && ' · Δ vs previous session'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
