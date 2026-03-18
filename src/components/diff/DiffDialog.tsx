import React, { useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  Box,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { JournalStore } from '../../app/Journal';
import type { Journal, ImportDiff } from '../../app/Journal';

interface DiffDialogProps {
  open: boolean;
  onClose: () => void;
  journal: Journal | null;
}

interface ItemChange {
  name: string;
  total: number;
  q: number[];
  newTotal: number;
}

const QUALITY_LABELS = ['N', 'S', 'G', '', 'I'];

function formatQualityBreakdown(q: number[]): string {
  return q
    .map((v, i) => (i !== 3 && v !== 0 ? `${QUALITY_LABELS[i]}:${v > 0 ? '+' : ''}${v}` : null))
    .filter(Boolean)
    .join('  ');
}

function ItemChangeTable({ rows }: { rows: ItemChange[] }) {
  return (
    <Table size="small" sx={{ mb: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ py: 0.5, fontWeight: 600 }}>Item</TableCell>
          <TableCell align="right" sx={{ py: 0.5, fontWeight: 600, width: 70 }}>Change</TableCell>
          <TableCell align="right" sx={{ py: 0.5, fontWeight: 600, width: 80 }}>New Total</TableCell>
          <TableCell sx={{ py: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>Quality</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(row => {
          const sign = row.total > 0 ? '+' : '';
          const multiTier = row.q.filter((v, i) => i !== 3 && v !== 0).length > 1;
          return (
            <TableRow key={row.name} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 0.5 }}>{row.name}</TableCell>
              <TableCell
                align="right"
                sx={{
                  py: 0.5,
                  fontWeight: 700,
                  color: row.total > 0 ? 'success.main' : 'error.main',
                }}
              >
                {sign}{row.total}
              </TableCell>
              <TableCell
                align="right"
                sx={{ py: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.secondary' }}
              >
                {row.newTotal.toLocaleString()}
              </TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
                {multiTier ? formatQualityBreakdown(row.q) : ''}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DiffDialog({ open, onClose, journal }: DiffDialogProps) {
  const availableDays = useMemo(() => {
    if (!journal) return [];
    return Object.keys(journal.days).map(Number).sort((a, b) => a - b);
  }, [journal]);

  const [fromDay, setFromDay] = useState<number>(0);
  const [toDay, setToDay] = useState<number>(0);

  useEffect(() => {
    if (!open || availableDays.length === 0) return;
    setToDay(availableDays[availableDays.length - 1]!);
    setFromDay(availableDays.length >= 2 ? availableDays[availableDays.length - 2]! : 0);
  }, [open, availableDays]);

  const diff: ImportDiff | null = useMemo(() => {
    if (!journal || toDay === 0) return null;
    return JournalStore.getDiffBetween(journal, fromDay, toDay);
  }, [journal, fromDay, toDay]);

  const { gained, lost } = useMemo(() => {
    if (!diff) return { gained: [], lost: [] };
    const all: ItemChange[] = Object.entries(diff.changes).map(([name, delta]) => {
      const currentItem = diff.currentItems[name];
      const newTotal = currentItem ? (currentItem.q as number[]).reduce((s, v) => s + v, 0) : 0;
      return {
        name,
        total: (delta.q as number[]).reduce((s, v) => s + v, 0),
        q: [...delta.q],
        newTotal,
      };
    });
    return {
      gained: all.filter(i => i.total > 0).sort((a, b) => b.total - a.total),
      lost: all.filter(i => i.total < 0).sort((a, b) => a.total - b.total),
    };
  }, [diff]);

  if (!journal || availableDays.length === 0 || !diff) return null;

  const isFirstImport = diff.previousDay === null;
  const qiChange = diff.currentQiGems - (diff.previousQiGems ?? diff.currentQiGems);
  const qiSign = qiChange > 0 ? '+' : '';
  const hasChanges = gained.length > 0 || lost.length > 0;
  const titleText = isFirstImport
    ? `First import — Day ${diff.currentDay}`
    : `Changes: Day ${diff.previousDay} → ${diff.currentDay}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{titleText}</DialogTitle>
      <DialogContent>
        {availableDays.length > 1 && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>From day</InputLabel>
              <Select
                label="From day"
                value={fromDay}
                onChange={e => {
                  const val = Number(e.target.value);
                  setFromDay(val);
                  if (toDay <= val) setToDay(availableDays.find(d => d > val) ?? toDay);
                }}
              >
                <MenuItem value={0}><em>Before first</em></MenuItem>
                {availableDays.filter(d => d < toDay).map(d => (
                  <MenuItem key={d} value={d}>Day {d}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>To day</InputLabel>
              <Select
                label="To day"
                value={toDay}
                onChange={e => {
                  const val = Number(e.target.value);
                  setToDay(val);
                  if (fromDay >= val) setFromDay(availableDays.filter(d => d < val).slice(-1)[0] ?? 0);
                }}
              >
                {availableDays.map(d => (
                  <MenuItem key={d} value={d} disabled={d <= fromDay}>Day {d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Qi Gems</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1">
                {!isFirstImport && diff.previousQiGems !== null ? (
                  <span style={{ color: 'var(--mui-palette-text-secondary, #666)' }}>{diff.previousQiGems} → </span>
                ) : null}
                <strong>{diff.currentQiGems}</strong>
              </Typography>
              {!isFirstImport && qiChange !== 0 && (
                <Chip
                  label={`${qiSign}${qiChange}`}
                  size="small"
                  color={qiChange > 0 ? 'success' : 'error'}
                />
              )}
            </Box>
          </Box>

          {!isFirstImport && diff.previousDay !== null && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Days elapsed</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1">
                  <span style={{ color: 'var(--mui-palette-text-secondary, #666)' }}>
                    {diff.previousDay} →{' '}
                  </span>
                  <strong>{diff.currentDay}</strong>
                </Typography>
                <Chip
                  label={`+${diff.currentDay - diff.previousDay}`}
                  size="small"
                  color="info"
                />
              </Box>
            </Box>
          )}
        </Box>

        {!hasChanges && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {isFirstImport ? 'Initial snapshot saved to journal.' : 'No item changes detected.'}
          </Typography>
        )}

        {gained.length > 0 && (
          <>
            <Typography variant="subtitle2" color="success.main" sx={{ mt: 1, mb: 0.5 }}>
              Gained ({gained.length} {gained.length === 1 ? 'item' : 'items'})
            </Typography>
            <ItemChangeTable rows={gained} />
          </>
        )}

        {gained.length > 0 && lost.length > 0 && <Divider sx={{ my: 1.5 }} />}

        {lost.length > 0 && (
          <>
            <Typography variant="subtitle2" color="error.main" sx={{ mt: 1, mb: 0.5 }}>
              Lost ({lost.length} {lost.length === 1 ? 'item' : 'items'})
            </Typography>
            <ItemChangeTable rows={lost} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
