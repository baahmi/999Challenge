import React, { useState, useRef } from 'react';
import './Header.css';
import {IconButton, Tooltip} from "@mui/material";
import {Upload, ViewWeekOutlined, Settings} from "@mui/icons-material";
import {ThemeToggle} from "@/components/theme/ThemeToggle.tsx";
import {ConfigDialog} from "@/components/config/ConfigDialog.tsx";
import {Config} from "../../config/Config.ts";
import {AppData} from "../../app/AppData.ts";

export function Header() {
    const [configOpen, setConfigOpen] = useState(false);
    const [tabsPosition, setTabsPosition] = useState(Config.getTabsPosition());
    const [qiGems, setQiGems] = useState<number | null>(null);
    const [daysPlayed, setDaysPlayed] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const handleConfigChange = () => {
            setTabsPosition(Config.getTabsPosition());
        };
        const unsubscribe = Config.getInstance().subscribe(handleConfigChange);
        return unsubscribe;
    }, []);

    React.useEffect(() => {
        const handleAppDataChange = () => {
            setQiGems(AppData.getQiGems());
            setDaysPlayed(AppData.getDaysPlayed());
        };
        const unsubscribe = AppData.subscribe(handleAppDataChange);
        return unsubscribe;
    }, []);

    const toggleTabsPosition = () => {
        const currentPosition = Config.getTabsPosition();
        const newPosition = currentPosition === 'bottom' ? 'top' : 'bottom';
        Config.getInstance().setTabsPosition(newPosition);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                await AppData.loadXmlFile(file);
            } catch (err) {
                console.error('Failed to load XML file:', err);
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <header className="header">
            <div className="container">
                {/* <div className="brand">999 Challenge</div> */}
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flex: 1, paddingLeft: '24px' }}>
                    <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>
                        Qi Gems: <strong>{qiGems !== null ? qiGems : 'Unknown'}</strong>
                    </div>
                    <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>
                        Days Played: <strong>{daysPlayed !== null ? daysPlayed : 'Unknown'}</strong>
                    </div>
                </div>
                <nav className="nav" aria-label="Primary" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <ThemeToggle/>
                    <Tooltip title="Upload XML file">
                        <IconButton 
                            size="small" 
                            onClick={handleUploadClick}
                        >
                            <Upload />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Move tabs to top/bottom">
                        <IconButton 
                            size="small" 
                            onClick={toggleTabsPosition}
                        >
                            <ViewWeekOutlined />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Settings">
                        <IconButton 
                            size="small" 
                            onClick={() => setConfigOpen(true)}
                        >
                            <Settings />
                        </IconButton>
                    </Tooltip>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </nav>
            </div>
            <ConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
        </header>
    );
}