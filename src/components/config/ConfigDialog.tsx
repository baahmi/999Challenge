import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  Box,
  Divider,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
} from '@mui/material';
import { ArrowDownward, ArrowUpward, DragIndicator } from '@mui/icons-material';
import { Config } from '../../config/Config';
import type { Quality } from '../../config/Config';
import { AppData } from '../../app/AppData';
import { useEffect } from 'react';

interface ConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConfigDialog({ open, onClose }: ConfigDialogProps) {
  const [quality, setQuality] = useState<Quality>(Config.getQuality());
  const [tabOrder, setTabOrder] = useState<string[]>(Config.getCategoryNames());
  const [confirmClear, setConfirmClear] = useState(false);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuality(Config.getQuality());
    setTabOrder(Config.getCategoryNames());
    setConfirmClear(false);
    setDraggedTab(null);
  }, [open]);

  const reorderTabs = (fromName: string, toName: string) => {
    if (fromName === toName) return;
    const next = [...tabOrder];
    const fromIndex = next.indexOf(fromName);
    const toIndex = next.indexOf(toName);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    setTabOrder(next);
  };

  const moveTab = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= tabOrder.length) return;
    const next = [...tabOrder];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(nextIndex, 0, moved);
    setTabOrder(next);
  };

  const handleSave = () => {
    Config.getInstance().setQuality(quality);
    Config.getInstance().setTabOrder(tabOrder);
    onClose();
  };

  const handleClearJournal = () => {
    AppData.clearJournal();
    setConfirmClear(false);
    onClose();
  };

  const qualityOptions: Quality[] = ['highest', 'any', 'normal', 'silver', 'gold', 'iridium', 'all'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Configuration</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <label style={{ fontSize: '1rem', fontWeight: 500, minWidth: '80px' }}>Quality:</label>
          <Select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            sx={{ fontSize: '1rem', flex: 1 }}
          >
            {qualityOptions.map((option) => (
              <MenuItem key={option} value={option} sx={{ fontSize: '1rem' }}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
            Tab order
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drag tabs to reorder them.
          </Typography>
          <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, py: 0 }}>
            {tabOrder.map((name, index) => (
              <Paper
                key={name}
                elevation={0}
                draggable
                onDragStart={() => setDraggedTab(name)}
                onDragEnd={() => setDraggedTab(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedTab) {
                    reorderTabs(draggedTab, name);
                  }
                  setDraggedTab(null);
                }}
                sx={{
                  borderRadius: 0,
                  borderBottom: index < tabOrder.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  backgroundColor: draggedTab === name ? 'action.selected' : 'background.paper'
                }}
              >
                <ListItem
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => moveTab(index, -1)} disabled={index === 0}>
                        <ArrowUpward fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => moveTab(index, 1)} disabled={index === tabOrder.length - 1}>
                        <ArrowDownward fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                  sx={{ cursor: 'grab' }}
                >
                  <DragIndicator fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                  <ListItemText primary={name} />
                </ListItem>
              </Paper>
            ))}
          </List>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '1rem', fontWeight: 500, minWidth: '80px' }}>Journal:</label>
          {confirmClear ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="error.main">Delete all journal data?</Typography>
              <Button size="small" onClick={handleClearJournal} color="error" variant="contained">
                Confirm
              </Button>
              <Button size="small" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              onClick={() => setConfirmClear(true)}
              color="error"
              variant="outlined"
              disabled={!AppData.hasJournal()}
            >
              Clear Journal
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
