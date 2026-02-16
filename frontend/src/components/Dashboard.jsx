
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
                // Check if scanning is in progress
                // Robust check: explicitly true OR a recently updated date during scan
                const isCurrentlyScanning = jsonData.isRunning === true;
                setIsScanning(isCurrentlyScanning);

                // Check if data actually changed (optional optimization, but nice for UX)
                if (JSON.stringify(jsonData) !== JSON.stringify(data)) {
                    setData(jsonData);
                    setRefreshFlash(true);
                    setTimeout(() => setRefreshFlash(false), 2000); // 2-second flash
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

    if (loading) return <div className="loading-screen">Loading Monitor...</div>;
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
        console.log('Scrape triggered via UI', options);

        // If progressive mode is enabled, immediately start fast polling
        if (options.progressiveMode) {
            setIsScanning(true); // Force fast polling mode

            // After 5 minutes, revert to normal polling (GitHub Actions should be done by then)
            setTimeout(() => {
                setIsScanning(false);
            }, 5 * 60 * 1000); // 5 minutes
        }
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
                        <p className="stat-value small">{searchTerm}</p>
                    </div>
                </div>
            </header>

            <main className="results-grid">
                {filteredResults.length === 0 ? (
                    <div className="empty-state">
                        {isScanning ? "Scanning for results..." : `No matches found for "${searchQuery}"`}
                        <br />
                        <small>(Scraped for: {effectiveSearchTerm})</small>
                    </div>
                ) : (
                    filteredResults.map((item, index) => (
                        <ShoeCard key={index} item={item} />
                    ))
                )}
            </main>
        </div >
    );
};

export default Dashboard;
