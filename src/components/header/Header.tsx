import React, { useState, useRef } from 'react';
import './Header.css';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip} from "@mui/material";
import {Upload, ViewWeekOutlined, Settings, FileDownload, CompareArrows, Category, Timeline, BarChart, HelpOutline, East} from "@mui/icons-material";
import {ThemeToggle} from "@/components/theme/ThemeToggle.tsx";
import {ConfigDialog} from "@/components/config/ConfigDialog.tsx";
import {DiffDialog} from "@/components/diff/DiffDialog.tsx";
import {CategoryDialog} from "../config/CategoryDialog.tsx";
import {HistoryDialog} from "../history/HistoryDialog.tsx";
import {StatsDialog} from "../stats/StatsDialog.tsx";
import {HelpDialog} from "../help/HelpDialog.tsx";
import {Config} from "../../config/Config.ts";
import {AppData} from "../../app/AppData.ts";

export function Header() {
    const [configOpen, setConfigOpen] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [tabsPosition, setTabsPosition] = useState(Config.getTabsPosition());
    const [qiGems, setQiGems] = useState<number | null>(null);
    const [daysPlayed, setDaysPlayed] = useState<number | null>(null);
    const [pastKids, setPastKids] = useState<number | null>(null);
    const [journalDays, setJournalDays] = useState(0);
    const [diffOpen, setDiffOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [showGettingStarted, setShowGettingStarted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const hasLoadedData = daysPlayed !== null || qiGems !== null || journalDays > 0;

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
            setPastKids(AppData.getChildrenTurnedToDoves());
            setJournalDays(AppData.getJournalDayCount());
        };
        const unsubscribe = AppData.subscribe(handleAppDataChange);
        return unsubscribe;
    }, []);

    React.useEffect(() => {
        if (!hasLoadedData) {
            setShowGettingStarted(true);
        } else {
            setShowGettingStarted(false);
        }
    }, [hasLoadedData]);

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
            if (file.name.endsWith('.json')) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text) as unknown;
                    const ok = AppData.loadJournalFromData(data);
                    if (!ok) console.error('Not a valid journal file');
                } catch (err) {
                    console.error('Failed to load journal file:', err);
                }
            } else {
                try {
                    await AppData.loadXmlFile(file);
                    setDiffOpen(true);
                } catch (err) {
                    console.error('Failed to load XML file:', err);
                }
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
                    <div style={{ fontSize: '14px' }}>
                        Qi Gems: <strong>{qiGems !== null ? qiGems : 'Unknown'}</strong>
                    </div>
                    <div style={{ fontSize: '14px' }}>
                        Days Played: <strong>{daysPlayed !== null ? daysPlayed : 'Unknown'}</strong>
                    </div>
                    {daysPlayed !== null && (
                        <div style={{ fontSize: '14px' }}>
                            Past Kids: <strong>{pastKids ?? 0}</strong>
                        </div>
                    )}
                    {journalDays > 0 && (
                        <div style={{ fontSize: '14px' }}>
                            Journal: <strong>{journalDays} {journalDays === 1 ? 'session' : 'sessions'}</strong>
                        </div>
                    )}
                </div>
                <nav className="nav" aria-label="Primary" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <ThemeToggle/>
                    <Tooltip title="Help">
                        <IconButton size="small" onClick={() => setHelpOpen(true)}>
                            <HelpOutline />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Player statistics">
                        <IconButton size="small" onClick={() => setStatsOpen(true)}>
                            <BarChart />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Item & progress history">
                        <IconButton size="small" onClick={() => setHistoryOpen(true)}>
                            <Timeline />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Manage categories & items">
                        <IconButton size="small" onClick={() => setCategoryOpen(true)}>
                            <Category />
                        </IconButton>
                    </Tooltip>
                    {journalDays > 0 && (
                        <Tooltip title="Show last import changes">
                            <IconButton size="small" onClick={() => setDiffOpen(true)}>
                                <CompareArrows />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title={journalDays > 0 ? `Download journal (${journalDays} sessions)` : 'No journal data yet'}>
                        <IconButton
                            size="small"
                            onClick={() => AppData.downloadJournal()}
                        >
                            <FileDownload />
                        </IconButton>
                    </Tooltip>
                    {!hasLoadedData && (
                        <div className="upload-callout" aria-live="polite">
                            <East className="upload-callout-arrow" fontSize="large" />
                            <div className="upload-callout-text">
                                <strong>Upload now</strong>
                                <span>Load a Stardew save file to get started.</span>
                            </div>
                        </div>
                    )}
                    <Tooltip title="Upload save file (.xml) or restore journal (.json)">
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
            {/*<CategoryDialog open={categoryOpen} onClose={() => setCategoryOpen(false)} />*/}
            <DiffDialog open={diffOpen} onClose={() => setDiffOpen(false)} journal={AppData.getJournal()} />
            <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} journal={AppData.getJournal()} />
            <StatsDialog open={statsOpen} onClose={() => setStatsOpen(false)} stats={AppData.getStats()} journal={AppData.getJournal()} />
            <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
            <Dialog open={showGettingStarted} onClose={() => setShowGettingStarted(false)} maxWidth="sm" fullWidth>
                <DialogTitle>To get started, upload your save file</DialogTitle>
                <DialogContent dividers>
                    <div className="getting-started-copy">
                        <p>This app needs a Stardew Valley save file before it can show your progress.</p>
                        <p>Common save locations:</p>
                        <ul>
                            <li>Windows: <code>%AppData%\StardewValley\Saves</code></li>
                            <li>macOS: <code>~/.config/StardewValley/Saves</code></li>
                            <li>Linux: <code>~/.config/StardewValley/Saves</code></li>
                        </ul>
                        <p>You can also restore a previously exported journal `.json` file.</p>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowGettingStarted(false)}>Later</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            setShowGettingStarted(false);
                            handleUploadClick();
                        }}
                        startIcon={<Upload />}
                    >
                        Upload now
                    </Button>
                </DialogActions>
            </Dialog>
        </header>
    );
}
