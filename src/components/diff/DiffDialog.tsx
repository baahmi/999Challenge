import React, { useMemo } from 'react';
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
} from '@mui/material';
import type { ImportDiff } from '../../app/Journal';

interface DiffDialogProps {
  open: boolean;
  onClose: () => void;
  diff: ImportDiff | null;
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

export function DiffDialog({ open, onClose, diff }: DiffDialogProps) {
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

  if (!diff) return null;

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
