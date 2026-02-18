import React, { useState, useEffect } from 'react';
import ShoeCard from './ShoeCard';
import ScraperControl from './ScraperControl';
import ScanningBanner from './ScanningBanner';

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshFlash, setRefreshFlash] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lastTriggerTime, setLastTriggerTime] = useState(null);
    const [triggeredSearchTerm, setTriggeredSearchTerm] = useState('');

    useEffect(() => {
        // Load persisted scanning state
        const savedTriggerTime = localStorage.getItem('lastTriggerTime');
        const savedTriggerTerm = localStorage.getItem('triggeredSearchTerm');
        if (savedTriggerTime) setLastTriggerTime(parseInt(savedTriggerTime));
        if (savedTriggerTerm) setTriggeredSearchTerm(savedTriggerTerm);

        fetchData(); // Initial load

        // Dynamic refresh interval: 3s when scanning, 60s when idle
        const interval = setInterval(() => {
            fetchData();
        }, isScanning ? 3000 : 60000);

        return () => clearInterval(interval);
    }, [isScanning]); // Re-create interval when scanning status changes

    const fetchData = (retryCount = 0) => {
        setError(null);
        const cacheBuster = new Date().getTime();

        // REAL-TIME FETCH STRATEGY
        // 1. Try fetching directly from GitHub Raw (updates immediately on push)
        // 2. Fallback to local/hosted file if that fails
        const rawUrl = `https://raw.githubusercontent.com/idobahir78/SneakerMonitor/main/frontend/public/data.json?t=${cacheBuster}`;
        const localUrl = `data.json?t=${cacheBuster}`;

        const handleData = (jsonData) => {
            const serverIsRunning = jsonData.isRunning === true;
            const serverUpdateTime = new Date(jsonData.updatedAt || jsonData.lastUpdated || 0).getTime();
            const currentTriggerTime = lastTriggerTime || parseInt(localStorage.getItem('lastTriggerTime') || '0');
            const isStale = currentTriggerTime > 0 && serverUpdateTime < currentTriggerTime;
            const isStillScanning = serverIsRunning || isStale;
            setIsScanning(isStillScanning);

            if (!isStale && JSON.stringify(jsonData) !== JSON.stringify(data)) {
                setData(jsonData);
                setRefreshFlash(true);
                setTimeout(() => setRefreshFlash(false), 2000);
            } else if (isStale) {
                // If data is stale (server has old data), we want to show "Scanning" state.
                // If 'data' is null (first load), we MUST initialize it to prevent "Initializing Data..." stick.
                if (!data) {
                    setData({
                        results: [],
                        searchTerm: triggeredSearchTerm || jsonData.searchTerm || '',
                        updatedAt: jsonData.updatedAt,
                        isRunning: true // Force running state visually
                    });
                } else if (data.results && data.results.length > 0) {
                    setData(prev => ({ ...prev, results: [] }));
                }
            }
            setLoading(false);
        };

        // Try Raw First
        fetch(rawUrl)
            .then(res => {
                if (!res.ok) throw new Error('Raw fetch failed');
                return res.json();
            })
            .then(data => {
                console.log('Fetched real-time data from GitHub Raw');
                handleData(data);
            })
            .catch(() => {
                console.log('Falling back to local data.json...');
                fetch(localUrl)
                    .then(res => {
                        if (!res.ok) throw new Error('Data file not found');
                        return res.json();
                    })
                    .then(data => handleData(data))
                    .catch(err => {
                        console.error("Error fetching data:", err);
                        if (!data && retryCount < 2) {
                            setTimeout(() => fetchData(retryCount + 1), 1000);
                        } else {
                            setError(err.message);
                            setLoading(false);
                        }
                    });
            });
    };

    if (error) return (
        <div className="error-screen">
            <p>Error: {error}</p>
            <button onClick={() => { setError(null); setLoading(true); fetchData(); }} className="retry-btn">
                🔄 Retry
            </button>
        </div>
    );
    if (loading && !data) return <div className="loading-screen">Loading Sneaker Monitor...</div>;
    if (!data) return <div className="loading-screen">Initializing Data...</div>;

    const { results, updatedAt, searchTerm, lastUpdated, lastSearchTerm } = data;

    // Unify schema locally (fallback for old data files)
    const effectiveResults = results || [];
    const effectiveUpdateAt = updatedAt || lastUpdated;

    // Display triggered term immediately if we're scanning and data hasn't caught up
    const isWaitingForNewData = isScanning && triggeredSearchTerm && (searchTerm !== triggeredSearchTerm && lastSearchTerm !== triggeredSearchTerm);
    const effectiveSearchTerm = isWaitingForNewData ? triggeredSearchTerm : (searchTerm || lastSearchTerm || 'Unknown');

    // Filter results based on client-side search
    // CRITICAL FIX: Safe check for item.store to prevent crash
    const filteredResults = effectiveResults.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.store || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Calculate Stats
    const totalFound = filteredResults.length;
    const lowestPrice = filteredResults.reduce((min, item) => (item.price < min ? item.price : min), Infinity);
    const bestPriceDisplay = totalFound > 0 && lowestPrice !== Infinity ? `₪${lowestPrice.toFixed(2)}` : '-';

    // Format Date
    const lastUpdatedDisplay = effectiveUpdateAt ? new Date(effectiveUpdateAt).toLocaleString() : 'N/A';

    // Handle scrape trigger from ScraperControl
    const handleScrapeTrigger = (options = {}) => {
        const now = new Date().getTime();
        const newSearchTerm = options.searchTerm || '';
        console.log('Scrape triggered via UI at:', now, options);

        // Record the exact time and term we started the search
        setLastTriggerTime(now);
        setTriggeredSearchTerm(newSearchTerm);
        setIsScanning(true);

        // Persist to survive refresh
        localStorage.setItem('lastTriggerTime', now.toString());
        localStorage.setItem('triggeredSearchTerm', newSearchTerm);

        // Clear current results immediately for visual feedback
        setData(prev => ({
            ...prev,
            results: [],
            searchTerm: '', // Clear this so we use triggeredSearchTerm
            lastSearchTerm: ''
        }));

        // Force an immediate refresh check in 10 seconds (allow Action to start)
        setTimeout(() => fetchData(), 10000);
    };

    return (
        <div className="dashboard-container">
            <ScraperControl onTrigger={handleScrapeTrigger} />

            <header className="dashboard-header">
                <h1>Sneaker Monitor 👟</h1>

                {/* Scanning Status Banner (New Component) */}
                {isScanning && (
                    <ScanningBanner startTime={lastTriggerTime || new Date().getTime()} />
                )}

                <p className={`last-updated ${refreshFlash ? 'flash-update' : ''}`}>
                    Last Updated: {lastUpdatedDisplay}
                    <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }}>
                        (↻ Auto-refresh {isScanning ? 'every 3s' : 'on'})
                    </span>
                </p>

                <div className="search-bar-container">
                    <input
                        type="text"
                        placeholder="Search model, store..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>Found</h3>
                        <p className="stat-value">{totalFound}</p>
                    </div>
                    <div className="stat-card">
                        <h3>Best Price</h3>
                        <p className="stat-value">{bestPriceDisplay}</p>
                    </div>
                    <div className="stat-card">
                        <h3>Scraper Query</h3>
                        <p className="stat-value small" title={effectiveSearchTerm}>{effectiveSearchTerm}</p>
                    </div>
                </div>
            </header>

            <main className="results-grid">
                {filteredResults.length === 0 ? (
                    <div className="empty-state">
                        {isScanning ? (
                            <>
                                <div className="spinner-small"></div>
                                <span>Scanning stores for "{effectiveSearchTerm}"...</span>
                            </>
                        ) : (
                            <>
                                <span>No matches found for "{searchQuery}"</span>
                                <br />
                                <small>(Last search: {effectiveSearchTerm})</small>
                            </>
                        )}
                    </div>
                ) : (
                    filteredResults.map((item) => (
                        <ShoeCard key={item.link} item={item} />
                    ))
                )}
            </main>
        </div >
    );
};

export default Dashboard;
