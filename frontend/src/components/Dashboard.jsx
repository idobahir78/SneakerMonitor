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
        const timestamp = Date.now();

        const rawUrl = `https://raw.githubusercontent.com/idobahir78/SneakerMonitor/main/frontend/public/data.json?t=${timestamp}`;
        const localUrl = `/data.json?t=${timestamp}`;

        const handleData = (jsonData) => {
            const serverUpdateTime = new Date(jsonData.lastUpdate || 0).getTime();
            const serverIsScanning = jsonData.isScanning === true;

            const triggerTime = lastTriggerTime || parseInt(localStorage.getItem('lastTriggerTime') || '0');
            const now = Date.now();

            // Safety Timeout: if scanning for > 5 minutes, force Idle
            const isStuck = triggerTime > 0 && (now - triggerTime > 300000);
            const isStale = triggerTime > 0 && serverUpdateTime < triggerTime;

            const stillScanning = (serverIsScanning || isStale) && !isStuck;

            setIsScanning(stillScanning);

            if (!isStale && JSON.stringify(jsonData) !== JSON.stringify(data)) {
                setData(jsonData);
                setRefreshFlash(true);
                setTimeout(() => setRefreshFlash(false), 2000);
            } else if (isStale && !data) {
                setData({
                    products: [],
                    lastUpdate: jsonData.lastUpdate,
                    isScanning: true
                });
            }
            setLoading(false);
        };

        fetch(rawUrl)
            .then(res => {
                if (!res.ok) throw new Error('Raw fetch failed');
                return res.json();
            })
            .then(data => handleData(data))
            .catch(() => {
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

    // Initial state handling to prevent "Black Screen"
    // Use default values if data is not yet loaded
    const effectiveResults = data?.results || [];
    const effectiveUpdateAt = data?.updatedAt || data?.lastUpdated;
    const currentSearchTerm = data?.searchTerm || data?.lastSearchTerm || '';

    // Display triggered term immediately if we're scanning and data hasn't caught up
    const isWaitingForNewData = isScanning && triggeredSearchTerm && (currentSearchTerm !== triggeredSearchTerm);
    const effectiveSearchTerm = isWaitingForNewData ? triggeredSearchTerm : (currentSearchTerm || 'Unknown');

    // Filter results based on client-side search
    const filteredResults = effectiveResults.filter(item => {
        const title = (item.display_title || item.title || '').toLowerCase();
        const store = (item.store_name || item.store || '').toLowerCase();
        return title.includes(searchQuery.toLowerCase()) || store.includes(searchQuery.toLowerCase());
    });

    const totalFound = filteredResults.length;
    // Support both new (price_ils) and legacy (price) field names
    const lowestPrice = filteredResults.reduce((min, item) => {
        const p = item.price_ils ?? item.price;
        return (p < min ? p : min);
    }, Infinity);
    const bestPriceDisplay = totalFound > 0 && lowestPrice !== Infinity ? `₪${lowestPrice.toFixed(2)}` : '-';

    // Format Date
    const lastUpdatedDisplay = effectiveUpdateAt ? new Date(effectiveUpdateAt).toLocaleString() : 'Loading...';

    const handleScrapeTrigger = (options = {}) => {
        const now = new Date().getTime();
        const newSearchTerm = options.searchTerm || '';
        console.log('Scrape triggered via UI at:', now, options);

        setLastTriggerTime(now);
        setTriggeredSearchTerm(newSearchTerm);
        setIsScanning(true);

        localStorage.setItem('lastTriggerTime', now.toString());
        localStorage.setItem('triggeredSearchTerm', newSearchTerm);

        setData(prev => ({
            ...prev,
            results: [],
            searchTerm: '',
            lastSearchTerm: ''
        }));

        setTimeout(() => fetchData(), 10000);
    };

    return (
        <div className="dashboard-container">
            <ScraperControl
                onTrigger={handleScrapeTrigger}
                autoScrapeEnabled={data?.autoScrapeEnabled}
                isSystemBusy={isScanning}
            />

            <header className="dashboard-header">
                <h1>Sneaker Monitor 👟</h1>

                {/* Scanning Status Banner */}
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
                        <p className="stat-value">{data ? totalFound : '-'}</p>
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
                {!data ? (
                    /* Skeleton / Loading State inside App Shell */
                    <div className="empty-state">
                        <div className="spinner-small"></div>
                        <span>Loading Data...</span>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="empty-state">
                        {isScanning ? (
                            <>
                                <div className="spinner-small"></div>
                                <span>Scanning stores for "{effectiveSearchTerm}"...</span>
                            </>
                        ) : (
                            <>
                                <span>No matches found for "{searchQuery || effectiveSearchTerm}"</span>
                                <br />
                                {searchQuery && <small>(Last search: {effectiveSearchTerm})</small>}
                            </>
                        )}
                    </div>
                ) : (
                    filteredResults.map((item) => (
                        <ShoeCard key={item.buy_link || item.link || item.id} item={item} />
                    ))
                )}
            </main>
        </div>
    );
};

export default Dashboard;
