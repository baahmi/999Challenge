import { IconButton, useColorScheme } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';

export function ThemeToggle() {
    const { mode, setMode } = useColorScheme();

    if (!mode) return null;

    return (
        <IconButton
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            sx={{
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: 'action.hover',
                },
            }}
        >
            {mode === 'dark' ? (
                <LightMode sx={{ color: 'warning.main' }} />
            ) : (
                <DarkMode sx={{ color: 'text.secondary' }} />
            )}
        </IconButton>
    );
}