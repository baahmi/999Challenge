import './Footer.css'
import React from 'react';
import {Copyright} from "./Copyright.tsx";

export function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <Copyright/>
            </div>
        </footer>
    );
}