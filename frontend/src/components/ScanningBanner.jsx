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
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
                width: '24px',
                height: '24px',
                animation: 'spin 2s linear infinite'
            }}>
                <path d="M12 22C17.5228 22 22 17.5228 22 12H19C19 15.866 15.866 19 12 19V22Z" fill="#ff4d4d" />
                <path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" fill="#ff4d4d" />
            </svg>
            <span style={{
                fontSize: '1em',
                fontWeight: '500',
                color: '#fff',
                letterSpacing: '0.5px'
            }}>
                Scanning... {elapsed}s
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
