import './Footer.css'
import React, { useState } from 'react';
import {Copyright} from "./Copyright.tsx";
import { APP_VERSION, BUILD_DATE } from "../../app/version";
import { ChangelogDialog } from "../changelog/ChangelogDialog";

export function Footer() {
    const [changelogOpen, setChangelogOpen] = useState(false);

    return (
        <footer className="footer">
            <div className="container">
                <Copyright/>
                <span className="footer-version">
                    v{APP_VERSION} · build {BUILD_DATE}
                    {' · '}
                    <button className="footer-link-button" onClick={() => setChangelogOpen(true)}>
                        changelog
                    </button>
                </span>
            </div>
            <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
        </footer>
    );
}
