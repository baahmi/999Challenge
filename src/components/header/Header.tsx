import React from 'react';
import './Header.css';

export function Header() {
    return (
        <header className="header">
            <div className="container">
                <div className="brand">999 Challenge</div>
                <nav className="nav" aria-label="Primary">
                    <a className="link" href="/">Home</a>
                    <a className="link" href="/about">About</a>
                    <a className="link" href="/contact">Contact</a>
                </nav>
            </div>
        </header>
    );
}