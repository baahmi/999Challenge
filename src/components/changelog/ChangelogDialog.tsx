import React, { useMemo } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Typography } from '@mui/material';
import { CHANGELOG_MARKDOWN } from '../../app/generatedChangelog';

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

function renderLine(line: string, index: number): React.ReactNode {
  if (line.startsWith('# ')) {
    return <Typography key={index} variant="h5" sx={{ mt: index === 0 ? 0 : 2, mb: 1 }}>{line.slice(2)}</Typography>;
  }
  if (line.startsWith('## ')) {
    return <Typography key={index} variant="h6" sx={{ mt: 2.5, mb: 1 }}>{line.slice(3)}</Typography>;
  }
  if (line.startsWith('### ')) {
    return <Typography key={index} variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 700 }}>{line.slice(4)}</Typography>;
  }
  if (line.startsWith('- ')) {
    return (
      <Box key={index} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
        <Typography component="span">•</Typography>
        <Typography component="span">{line.slice(2)}</Typography>
      </Box>
    );
  }
  if (/^\d+\.\s/.test(line)) {
    const text = line.replace(/^\d+\.\s/, '');
    return (
      <Box key={index} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
        <Typography component="span">{line.match(/^\d+/)?.[0]}.</Typography>
        <Typography component="span">{text}</Typography>
      </Box>
    );
  }
  if (!line.trim()) {
    return <Box key={index} sx={{ height: 8 }} />;
  }
  return <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>{line}</Typography>;
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  const content = useMemo(() => CHANGELOG_MARKDOWN.split('\n').map(renderLine), []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Changelog</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ fontSize: 14, lineHeight: 1.55 }}>
          {content}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
