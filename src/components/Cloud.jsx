import React from 'react';

const Cloud = ({ width, height, className = '', opacity = 1 }) => {
    return (
        <svg
            {...(width && width !== 'auto' ? { width } : {})}
            {...(height && height !== 'auto' ? { height } : {})}
            viewBox="0 0 400 250"
            className={className}
            style={{ opacity }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="cloudGradMain" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#E2E8F0" />
                </linearGradient>
                <linearGradient id="cloudGradTop" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#F1F5F9" />
                </linearGradient>
                <filter id="cloudShadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="25" stdDeviation="25" floodColor="#000000" floodOpacity="0.35" />
                </filter>
            </defs>
            <g filter="url(#cloudShadow)">
                {/* Main Body */}
                <path d="M 120 200 
                         A 70 70 0 0 1 120 60
                         A 90 90 0 0 1 270 50
                         A 65 65 0 0 1 340 130
                         A 50 50 0 0 1 330 200 
                         Z" 
                      fill="url(#cloudGradMain)" />
                <rect x="120" y="110" width="210" height="90" rx="30" fill="url(#cloudGradMain)" />
                
                {/* Additional Fluff */}
                <circle cx="100" cy="150" r="50" fill="url(#cloudGradMain)" />
                <circle cx="210" cy="80" r="70" fill="url(#cloudGradMain)" />
                <circle cx="290" cy="120" r="50" fill="url(#cloudGradMain)" />
            </g>
            
            {/* Highlight overlay slightly offset upward for depth */}
            <g transform="translate(0, -6)">
                <path d="M 120 200 
                         A 70 70 0 0 1 120 60
                         A 90 90 0 0 1 270 50
                         A 65 65 0 0 1 340 130
                         A 50 50 0 0 1 330 200 
                         Z" 
                      fill="url(#cloudGradTop)" />
                <rect x="120" y="110" width="210" height="90" rx="30" fill="url(#cloudGradTop)" />
                
                <circle cx="100" cy="150" r="50" fill="url(#cloudGradTop)" />
                <circle cx="210" cy="80" r="70" fill="url(#cloudGradTop)" />
                <circle cx="290" cy="120" r="50" fill="url(#cloudGradTop)" />
            </g>
        </svg>
    );
};

export default Cloud;