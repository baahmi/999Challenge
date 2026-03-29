import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Chip, TextField, Select, MenuItem,
  Typography, Divider, IconButton, InputAdornment, Tooltip,
} from '@mui/material';
import { Add, Search, Edit } from '@mui/icons-material';
import { CustomDataStore } from '../../data/CustomDataStore';
import type { CustomData } from '../../data/CustomDataStore';

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CategoryDialog({ open, onClose }: CategoryDialogProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<[string, string, string][]>([]);
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
    () => categories.filter(c => c !== 'asdf').sort((a, b) => a.localeCompare(b)),
    [categories]
  );

  const filteredItems = useMemo(() => {
    return items
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry: [cat, name] }) => {
        const catMatch = filterCat === 'All' || cat === filterCat;
        const nameMatch = name.toLowerCase().includes(search.toLowerCase());
        return catMatch && nameMatch;
      });
  }, [items, filterCat, search]);

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || categories.includes(name)) return;
    setCategories(prev => [...prev, name]);
    setNewCatName('');
  };

  const deleteCategory = (cat: string) => {
    setCategories(prev => prev.filter(c => c !== cat));
    setItems(prev => prev.map(([c, n]) => c === cat ? ['asdf', n, n] : [c, n, n]));
    if (filterCat === cat) setFilterCat('All');
  };

  const startRename = (cat: string) => {
    setEditingCat(cat);
    setEditingCatName(cat);
  };

  const commitRename = () => {
    if (!editingCat) return;
    const newName = editingCatName.trim();
    if (!newName || (newName !== editingCat && categories.includes(newName))) {
      setEditingCat(null);
      return;
    }
    if (newName !== editingCat) {
      setCategories(prev => prev.map(c => c === editingCat ? newName : c));
      setItems(prev => prev.map(([c, n]) => c === editingCat ? [newName, n, n] : [c, n, n]));
      if (filterCat === editingCat) setFilterCat(newName);
    }
    setEditingCat(null);
  };

  const changeItemCategory = (originalIdx: number, newCat: string) => {
    setItems(prev => prev.map((entry, i) => i === originalIdx ? [newCat, entry[1]!, entry[1]!] : entry));
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

  const selectCategories = ['All', ...visibleCategories, 'asdf'];
  const itemSelectCategories = [...visibleCategories, 'asdf'];

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
              <Tooltip key={cat} title="Click to rename">
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
              <MenuItem key={c} value={c}>{c === 'asdf' ? '(unassigned)' : c}</MenuItem>
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
              {filteredItems.map(({ entry: [cat, name], idx }) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                  <td style={{ padding: '3px 12px', fontSize: '0.875rem' }}>{name}</td>
                  <td style={{ padding: '3px 12px' }}>
                    <select
                      value={cat}
                      onChange={e => changeItemCategory(idx, e.target.value)}
                      style={{ fontSize: '0.85rem', minWidth: 160, padding: '3px 6px' }}
                    >
                      {itemSelectCategories.map(c => (
                        <option key={c} value={c}>
                          {c === 'asdf' ? '(unassigned)' : c}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
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
