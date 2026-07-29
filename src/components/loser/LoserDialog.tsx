import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AppData } from '../../app/AppData';
import type { LocatedItem } from '../../app/AppData';
import { ItemSprite } from '../table/ItemSprite';

interface LoserDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ResultRow {
  name: string;
  itemId: string;
  stack: number;
  stacks: number;
  path: string[];
}

const MAX_RESULTS = 250;
const QUALITY_LABELS = ['', ' (silver)', ' (gold)', '', ' (iridium)'];

function groupMatches(locations: LocatedItem[], query: string): ResultRow[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const groups = new Map<string, ResultRow>();
  for (const item of locations) {
    if (!item.name.toLowerCase().includes(q) && !item.itemId.toLowerCase().includes(q)) continue;
    const name = item.name + (QUALITY_LABELS[item.quality] ?? '');
    const key = `${name}|${item.itemId}|${item.path.join('>')}`;
    const existing = groups.get(key);
    if (existing) {
      existing.stack += item.stack;
      existing.stacks += 1;
    } else {
      groups.set(key, { name, itemId: item.itemId, stack: item.stack, stacks: 1, path: item.path });
    }
  }

  return [...groups.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.path.join('>').localeCompare(b.path.join('>'))
  );
}

export function LoserDialog({ open, onClose }: LoserDialogProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const locations = AppData.getItemLocations();
  const results = useMemo(() => groupMatches(locations, query), [locations, query]);
  const shown = results.slice(0, MAX_RESULTS);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        I am a loser
        <Typography variant="body2" color="text.secondary">
          Find where you left an item. Searches the last loaded save file.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 300 }}>
        {locations.length === 0 ? (
          <Alert severity="info">
            No location data yet. Upload your save file to search it — item locations are read
            straight from the file and are not kept in the journal.
          </Alert>
        ) : (
          <>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="Item name or id — e.g. Galaxy Sword, Prismatic Shard, (O)74"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ mb: 2 }}
            />
            {query.trim().length < 2 ? (
              <Typography variant="body2" color="text.secondary">
                Type at least two characters. Everything in the save is searchable: weapons, tools,
                furniture, chest contents, equipped gear, Junimo chests, the fridge…
              </Typography>
            ) : results.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing found. It might be truly lost — or check the spelling.
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {results.length > MAX_RESULTS
                    ? `Showing the first ${MAX_RESULTS} of ${results.length} places — keep typing to narrow it down.`
                    : `Found in ${results.length} ${results.length === 1 ? 'place' : 'places'}.`}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Where</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shown.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }} title={row.itemId}>
                          <ItemSprite name={row.name} itemId={row.itemId} /> {row.name}
                        </TableCell>
                        <TableCell align="right">
                          {row.stack.toLocaleString()}
                          {row.stacks > 1 ? ` (${row.stacks} stacks)` : ''}
                        </TableCell>
                        <TableCell>{row.path.length > 0 ? row.path.join(' › ') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
