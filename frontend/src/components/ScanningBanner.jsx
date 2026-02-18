import React, { useState, useEffect } from 'react';
import BasketballIcon from './BasketballIcon';

const ScanningBanner = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const seconds = Math.floor((new Date().getTime() - startTime) / 1000);
            setElapsed(seconds);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="scanning-banner" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            margin: '20px auto',
            maxWidth: '400px',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            {/* Spinning Basketball Icon */}
            {/* Spinning Basketball Icon */}
            <BasketballIcon className="basketball-icon" />
            <span style={{
                fontSize: '1em',
                fontWeight: '500',
                color: '#fff',
                letterSpacing: '0.5px',
                fontVariantNumeric: 'tabular-nums'
            }}>
                Scanning... {formatTime(elapsed)}
            </span>
            <style>{`
                .basketball-icon {
                    width: 32px;
                    height: 32px;
                    animation: spin 3s linear infinite;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ScanningBanner;
