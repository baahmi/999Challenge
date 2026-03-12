import './Footer.css'
import React from 'react';

export function Footer() {

    const year = new Date().getFullYear();
    return (
        <footer className="footer">
            <div className="container">
                <span>© {year} MyApp. All rights reserved.</span>
            </div>
        </footer>
    );
}