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
} from '@mui/material';
import { Config } from '../../config/Config';
import type { Quality } from '../../config/Config';
import { AppData } from '../../app/AppData';

interface ConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConfigDialog({ open, onClose }: ConfigDialogProps) {
  const [quality, setQuality] = useState<Quality>(Config.getQuality());
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSave = () => {
    Config.getInstance().setQuality(quality);
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
