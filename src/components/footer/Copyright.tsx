import './Footer.css'
import React from 'react'

export function Copyright() {

    const startYear: Number = 2026;
    const year: Number = new Date().getFullYear();
    let yearString: string = startYear.toString();
    if (year > startYear) {
        yearString += ` - ${year}`;
    }
    return(
        <span>© {yearString} 999Challenge App. All rights reserved.</span>
    )

}