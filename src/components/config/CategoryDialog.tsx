import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Chip, TextField, Select, MenuItem,
  Typography, Divider, IconButton, InputAdornment, Tooltip,
} from '@mui/material';
import { Add, Search, Edit } from '@mui/icons-material';
import { CustomDataStore } from '../../data/CustomDataStore';
import type { CustomData, ItemEntry } from '../../data/CustomDataStore';
import { ItemSprite } from '../table/ItemSprite';

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
}

const UNASSIGNED = 'asdf';
const MAX_ROWS = 400;

export function CategoryDialog({ open, onClose }: CategoryDialogProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [filterCat, setFilterCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (open) {
      setCategories(CustomDataStore.getCategoryNames());
      setItems(CustomDataStore.getItemsData());
      setNewCatName('');
      setEditingCat(null);
      setConfirmReset(false);
      setFilterCat('All');
      setSearch('');
    }
  }, [open]);

  const visibleCategories = useMemo(
    () => categories.filter(c => c !== UNASSIGNED).sort((a, b) => a.localeCompare(b)),
    [categories]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => {
        if (filterCat !== 'All' && entry.category !== filterCat) return false;
        if (!query) return true;
        const label = entry.displayName ?? entry.name;
        return label.toLowerCase().includes(query) || entry.name.toLowerCase().includes(query);
      });
  }, [items, filterCat, search]);

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || name === UNASSIGNED || categories.includes(name)) return;
    setCategories(prev => [...prev, name]);
    setNewCatName('');
  };

  const deleteCategory = (cat: string) => {
    setCategories(prev => prev.filter(c => c !== cat));
    // Items of a deleted category become unassigned
    setItems(prev => prev.map(item => item.category === cat ? { ...item, category: UNASSIGNED } : item));
    if (filterCat === cat) setFilterCat('All');
  };

  const startRename = (cat: string) => {
    setEditingCat(cat);
    setEditingCatName(cat);
  };

  const commitRename = () => {
    if (!editingCat) return;
    const newName = editingCatName.trim();
    if (!newName || newName === UNASSIGNED || (newName !== editingCat && categories.includes(newName))) {
      setEditingCat(null);
      return;
    }
    if (newName !== editingCat) {
      setCategories(prev => prev.map(c => c === editingCat ? newName : c));
      setItems(prev => prev.map(item => item.category === editingCat ? { ...item, category: newName } : item));
      if (filterCat === editingCat) setFilterCat(newName);
    }
    setEditingCat(null);
  };

  const changeItemCategory = (originalIdx: number, newCat: string) => {
    setItems(prev => prev.map((entry, i) => i === originalIdx ? { ...entry, category: newCat } : entry));
  };

  const handleSave = () => {
    const data: CustomData = { categoryNames: categories, items };
    CustomDataStore.setData(data);
    onClose();
  };

  const handleReset = () => {
    const d = CustomDataStore.getDefaults();
    setCategories(d.categoryNames);
    setItems(d.items);
    setConfirmReset(false);
  };

  const selectCategories = ['All', ...visibleCategories, UNASSIGNED];
  const itemSelectCategories = [...visibleCategories, UNASSIGNED];
  const shownItems = filteredItems.slice(0, MAX_ROWS);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Manage Categories &amp; Items</DialogTitle>
      <DialogContent dividers>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Categories
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
          {visibleCategories.map(cat => (
            editingCat === cat ? (
              <TextField
                key={cat}
                size="small"
                value={editingCatName}
                autoFocus
                onChange={e => setEditingCatName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingCat(null);
                }}
                sx={{ width: 160 }}
              />
            ) : (
              <Tooltip key={cat} title="Click to rename, ✕ to delete (items become unassigned)">
                <Chip
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {cat}
                      <Edit sx={{ fontSize: 12, opacity: 0.5 }} />
                    </Box>
                  }
                  size="small"
                  onClick={() => startRename(cat)}
                  onDelete={() => deleteCategory(cat)}
                />
              </Tooltip>
            )
          ))}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 1 }}>
            <TextField
              size="small"
              placeholder="New category…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
              sx={{ width: 160 }}
            />
            <IconButton size="small" onClick={addCategory} disabled={!newCatName.trim()}>
              <Add />
            </IconButton>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Items ({filteredItems.length}{filterCat !== 'All' || search ? ` filtered` : ` total`})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Select
            size="small"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {selectCategories.map(c => (
              <MenuItem key={c} value={c}>{c === UNASSIGNED ? '(unassigned)' : c}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
              }
            }}
            sx={{ flex: 1 }}
          />
        </Box>

        <Box sx={{ maxHeight: 380, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 12px', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid rgba(128,128,128,0.3)', backgroundColor: 'inherit' }}>Item</th>
                <th style={{ padding: '6px 12px', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid rgba(128,128,128,0.3)', backgroundColor: 'inherit' }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {shownItems.map(({ entry, idx }) => {
                const label = entry.displayName ?? entry.name;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                    <td style={{ padding: '3px 12px', fontSize: '0.875rem' }}>
                      <ItemSprite name={label} /> {label}
                    </td>
                    <td style={{ padding: '3px 12px' }}>
                      <select
                        value={entry.category}
                        onChange={e => changeItemCategory(idx, e.target.value)}
                        style={{ fontSize: '0.85rem', minWidth: 160, padding: '3px 6px' }}
                      >
                        {!itemSelectCategories.includes(entry.category) && (
                          <option value={entry.category}>{entry.category}</option>
                        )}
                        {itemSelectCategories.map(c => (
                          <option key={c} value={c}>
                            {c === UNASSIGNED ? '(unassigned)' : c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length > MAX_ROWS && (
                <tr>
                  <td colSpan={2} style={{ padding: '8px 12px', opacity: 0.6, fontSize: '0.8rem' }}>
                    Showing the first {MAX_ROWS} of {filteredItems.length} — filter or search to narrow down.
                  </td>
                </tr>
              )}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '16px', textAlign: 'center', opacity: 0.5 }}>
                    No items match
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>
      </DialogContent>

      <DialogActions>
        {confirmReset ? (
          <>
            <Typography variant="body2" color="error.main" sx={{ flex: 1, pl: 1 }}>
              Reset all categories and items to defaults?
            </Typography>
            <Button onClick={handleReset} color="error" variant="contained" size="small">Confirm</Button>
            <Button onClick={() => setConfirmReset(false)} size="small">Cancel</Button>
          </>
        ) : (
          <>
            <Button onClick={() => setConfirmReset(true)} color="warning" size="small">Reset to Defaults</Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">Save</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
