import React, { useMemo } from 'react';
import Cloud from './Cloud';

const GlobalCloudTransition = ({ isAnimating }) => {
    // Generate massive overlapping clouds with custom independent trajectories
    const clouds = useMemo(() => {
        // Determine if mobile based on screen width
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const numClouds = isMobile ? 15 : 40;

        return Array.from({ length: numClouds }).map((_, i) => {
            // Use central bias (averaging two Math.random() calls creates a nice bell curve)
            const biasLeft = (Math.random() + Math.random()) / 2;
            const biasTop = (Math.random() + Math.random()) / 2;

            return {
                id: i,
                left: `${biasLeft * 100}%`,                 // 0% to 100%, but heavily clustered at 50%
                stopY: `${biasTop * 100}vh`,                // 0vh to 100vh, deeply concentrated around 50vh
                enterDist: `${Math.random() * 30 + 100}vh`, // Drift distance into screen (100vh to 180vh)
                exitDist: `${Math.random() * 100 + 160}vh`, // Exit distance (160vh to 260vh guarantees clearing top viewport)
                width: Math.random() * 450 + 450,           // 450px to 900px wide
                zIndex: 100 + i,
                scale: Math.random() * 0.4 + 0.8,
            };
        });
    }, [isAnimating]); // Recompute trajectories when animation triggers so it handles resizes / varied looks

    if (!isAnimating) return null;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden no-scrollbar">
            {clouds.map((c) => (
                <div
                    key={`cloud-${c.id}`}
                    className="absolute top-0 will-change-transform cloud-free-agent"
                    style={{
                        left: c.left,
                        width: `${c.width}px`,
                        zIndex: c.zIndex,
                        "--stop-y": c.stopY,
                        "--enter-dist": c.enterDist,
                        "--exit-dist": c.exitDist,
                        "--scale": c.scale
                    }}
                >
                    <Cloud width="100%" height="auto" />
                </div>
            ))}
        </div>
    );
};

export default GlobalCloudTransition;
