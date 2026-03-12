import React from 'react';
import './Header.css';
import {IconButton} from "@mui/material";
import {ThemeToggle} from "@/components/theme/ThemeToggle.tsx";

export function Header() {
    return (
        <header className="header">
            <div className="container">
                <div className="brand">999 Challenge</div>
                <nav className="nav" aria-label="Primary">
                    <a className="link" href="/">Home</a>
                    <a className="link" href="/about">About</a>
                    <ThemeToggle/>
                </nav>
            </div>
        </header>
    );
}