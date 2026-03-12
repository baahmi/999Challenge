import React, {type PropsWithChildren } from 'react';
import './Main.css';

type MainProps = PropsWithChildren<{
    // flexibility if you need nested "main" later
    as?: 'main' | 'div';
}>;

export function Main({ as: As = 'main', children }: MainProps) {
    return (
        <As className="main">
            <div className="container">{children}</div>
        </As>
    );
}