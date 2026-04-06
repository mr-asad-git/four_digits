import React from 'react';

const Cloud = ({ width, height, className, opacity = 1 }) => {
    return (
        <svg
            {...(width && width !== 'auto' ? { width } : {})}
            {...(height && height !== 'auto' ? { height } : {})}
            viewBox="0 0 200 120"
            className={className}
            style={{ opacity }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                </filter>
                <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#f0f0f0', stopOpacity: 1 }} />
                </linearGradient>
            </defs>
            <g filter="url(#cloudBlur)">
                <circle cx="50" cy="70" r="35" fill="white" />
                <circle cx="85" cy="55" r="45" fill="white" />
                <circle cx="125" cy="50" r="40" fill="white" />
                <circle cx="155" cy="75" r="35" fill="white" />
                <rect x="50" y="75" width="105" height="30" fill="white" />
            </g>
            <g>
                <circle cx="50" cy="70" r="30" fill="url(#cloudGrad)" />
                <circle cx="85" cy="55" r="40" fill="url(#cloudGrad)" />
                <circle cx="125" cy="50" r="35" fill="url(#cloudGrad)" />
                <circle cx="155" cy="75" r="30" fill="url(#cloudGrad)" />
                <rect x="50" y="75" width="105" height="25" fill="url(#cloudGrad)" />
            </g>
        </svg>
    );
};

export default Cloud;