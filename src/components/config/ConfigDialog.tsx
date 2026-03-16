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
} from '@mui/material';
import { Config } from '../../config/Config';
import type { Quality } from '../../config/Config';

interface ConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConfigDialog({ open, onClose }: ConfigDialogProps) {
  const [quality, setQuality] = useState<Quality>(Config.getQuality());

  const handleSave = () => {
    Config.getInstance().setQuality(quality);
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
