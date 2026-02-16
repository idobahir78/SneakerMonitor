
import React, { useState, useEffect } from 'react';
import ShoeCard from './ShoeCard';

import ScraperControl from './ScraperControl';

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshFlash, setRefreshFlash] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lastTriggerTime, setLastTriggerTime] = useState(null);

    const fetchData = () => {
        // Add timestamp to prevent caching
        const cacheBuster = new Date().getTime();
        fetch(`data.json?t=${cacheBuster}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Data file not found (run scraper first!)');
                }
                return response.json();
            })
            .then(jsonData => {
                // Determine if we are still scanning
                const serverIsRunning = jsonData.isRunning === true;
                const serverUpdateTime = new Date(jsonData.updatedAt || jsonData.lastUpdated).getTime();

                // We are scanning if:
                // 1. Server explicitly says it's running
                // 2. OR we triggered a search recently and the server hasn't updated since then
                const isStillScanning = serverIsRunning || (lastTriggerTime && serverUpdateTime < lastTriggerTime);

                setIsScanning(isStillScanning);

                // Check if data actually changed
                if (JSON.stringify(jsonData) !== JSON.stringify(data)) {
                    setData(jsonData);
                    setRefreshFlash(true);
                    setTimeout(() => setRefreshFlash(false), 2000);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching data:", err);
                setError(err.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData(); // Initial load

        // Dynamic refresh interval: 3s when scanning, 60s when idle
        const interval = setInterval(() => {
            fetchData();
        }, isScanning ? 3000 : 60000);

        return () => clearInterval(interval);
    }, [isScanning]); // Re-create interval when scanning status changes

    if (loading || !data) return <div className="loading-screen">Loading Sneaker Monitor...</div>;
    if (error) return <div className="error-screen">Error: {error}</div>;

    const { results, updatedAt, searchTerm, lastUpdated, lastSearchTerm } = data;

    // Unify schema locally (fallback for old data files)
    const effectiveResults = results || [];
    const effectiveUpdateAt = updatedAt || lastUpdated;
    const effectiveSearchTerm = searchTerm || lastSearchTerm || 'Unknown';

    // Filter results based on client-side search
    const filteredResults = effectiveResults.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.store.toLowerCase().includes(searchQuery.toLowerCase())
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
        console.log('Scrape triggered via UI at:', now, options);

        // Record the exact time we started the search
        setLastTriggerTime(now);
        setIsScanning(true);

        // Force an immediate refresh check in 10 seconds (allow Action to start)
        setTimeout(() => fetchData(), 10000);
    };

    return (
        <div className="dashboard-container">
            <ScraperControl onTrigger={handleScrapeTrigger} />

            <header className="dashboard-header">
                <h1>Sneaker Monitor 👟</h1>

                {/* Scanning Status Banner */}
                {isScanning && (
                    <div className="scanning-banner">
                        <span className="scanning-icon">🔄</span>
                        <span className="scanning-text">Scanning in progress...</span>
                        <span className="results-count">{filteredResults.length} items found</span>
                    </div>
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
