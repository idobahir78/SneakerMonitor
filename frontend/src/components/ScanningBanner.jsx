import React, { useState, useEffect } from 'react';

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
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
                width: '24px',
                height: '24px',
                animation: 'spin 2s linear infinite'
            }}>
                <circle cx="12" cy="12" r="10" stroke="#ff7f50" strokeWidth="2" />
                <path d="M12 2C12 2 12 22 12 22" stroke="#ff7f50" strokeWidth="2" />
                <path d="M2 12C2 12 22 12 22 12" stroke="#ff7f50" strokeWidth="2" />
                <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="#ff7f50" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 22C17.5228 22 22 17.5228 22 12" stroke="#ff7f50" strokeWidth="2" strokeLinecap="round" />
            </svg>
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
