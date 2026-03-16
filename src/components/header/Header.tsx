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
    const headerRef = useRef<HTMLElement>(null);

    React.useEffect(() => {
        if (!headerRef.current) return;
        const updateHeight = () => {
            document.documentElement.style.setProperty(
                '--header-height',
                `${headerRef.current!.offsetHeight}px`
            );
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(headerRef.current);
        return () => observer.disconnect();
    }, []);

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

    const TABS_CYCLE: import('../../config/Config').TabsPosition[] = ['top', 'bottom', 'both'];
    const TABS_LABELS: Record<string, string> = { top: 'Top only', bottom: 'Bottom only', both: 'Both' };

    const toggleTabsPosition = () => {
        const current = Config.getTabsPosition();
        const next = TABS_CYCLE[(TABS_CYCLE.indexOf(current) + 1) % TABS_CYCLE.length] ?? 'bottom';
        Config.getInstance().setTabsPosition(next);
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
        <header className="header" ref={headerRef}>
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
                    <Tooltip title={`Tabs: ${TABS_LABELS[tabsPosition]} — click to cycle`}>
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