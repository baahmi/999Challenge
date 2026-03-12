import React, {type PropsWithChildren } from 'react';
import './Main.css';


export function Main({children }: PropsWithChildren) {
    return (
        <div className="container">{children}</div>
    );
}