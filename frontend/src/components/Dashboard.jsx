import React, { useState, useEffect } from 'react';
import ShoeCard from './ShoeCard';
import ScraperControl from './ScraperControl';
import ScanningBanner from './ScanningBanner';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
    const [data, setData] = useState({ products: [], isScanning: false, lastUpdate: '' });
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

        // Dynamic refresh interval: 3s when scanning, 30s when idle
        const interval = setInterval(() => {
            fetchData();
        }, isScanning ? 3000 : 30000);

        return () => clearInterval(interval);
    }, [isScanning]); // Re-create interval when scanning status changes

    const fetchData = async () => {
        setError(null);
        try {
            // 1. Fetch System State
            const { data: stateData, error: stateError } = await supabase
                .from('system_state')
                .select('*')
                .eq('id', 1)
                .single();

            if (stateError) throw stateError;

            const serverIsScanning = stateData?.is_scanning || false;
            const serverUpdateTime = new Date(stateData?.last_run || 0).getTime();

            const triggerTime = lastTriggerTime || parseInt(localStorage.getItem('lastTriggerTime') || '0');
            const now = Date.now();

            // Safety Timeout: if scanning for > 5 minutes, force Idle
            const isStuck = triggerTime > 0 && (now - triggerTime > 300000);
            const isStale = triggerTime > 0 && serverUpdateTime < triggerTime;

            const stillScanning = (serverIsScanning || isStale) && !isStuck;
            setIsScanning(stillScanning);

            // 2. Fetch Products
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (productsError) throw productsError;

            // Map DB schema to frontend ShoeCard schema
            const mappedProducts = (productsData || []).map(p => ({
                id: p.id,
                title: `${p.brand} ${p.model}`,
                price: p.price,
                store: p.site,
                link: p.product_url,
                image_url: p.image_url,
                sizes: p.sizes || []
            }));

            const newDataState = {
                products: mappedProducts,
                isScanning: stillScanning,
                lastUpdate: stateData?.last_run || new Date().toISOString()
            };

            // Detect new updates
            if (JSON.stringify(newDataState.products) !== JSON.stringify(data.products)) {
                setData(newDataState);
                if (!isStale) {
                    setRefreshFlash(true);
                    setTimeout(() => setRefreshFlash(false), 2000);
                }
            } else if (isStale && data.products.length === 0) {
                // Ensure UI reflects scanning state even if no products
                setData(newDataState);
            }

            setLoading(false);
        } catch (err) {
            console.error("Error fetching from Supabase:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    if (error) return (
        <div className="error-screen">
            <p>Error: {error}</p>
            <button onClick={() => { setError(null); setLoading(true); fetchData(); }} className="retry-btn">
                🔄 Retry
            </button>
        </div>
    );

    const effectiveResults = data?.products || [];
    const effectiveUpdateAt = data?.lastUpdate;
    const currentSearchTerm = triggeredSearchTerm || '';

    const filteredResults = effectiveResults.filter(item => {
        const title = (item.title || '').toLowerCase();
        const store = (item.store || '').toLowerCase();
        return title.includes(searchQuery.toLowerCase()) || store.includes(searchQuery.toLowerCase());
    });

    const totalFound = filteredResults.length;
    const lowestPrice = filteredResults.reduce((min, item) => {
        const p = item.price;
        return (p && p < min ? p : min);
    }, Infinity);
    const bestPriceDisplay = totalFound > 0 && lowestPrice !== Infinity ? `₪${lowestPrice.toFixed(2)}` : '-';

    const lastUpdatedDisplay = effectiveUpdateAt ? new Date(effectiveUpdateAt).toLocaleString() : 'Loading...';

    const handleScrapeTrigger = (options = {}) => {
        const now = new Date().getTime();
        const newSearchTerm = options.searchTerm || '';

        setLastTriggerTime(now);
        setTriggeredSearchTerm(newSearchTerm);
        setIsScanning(true);

        localStorage.setItem('lastTriggerTime', now.toString());
        localStorage.setItem('triggeredSearchTerm', newSearchTerm);

        // Flash UI to scanning state immediately
        setData({ products: [], isScanning: true, lastUpdate: new Date().toISOString() });
        setTimeout(() => fetchData(), 5000);
    };

    return (
        <div className="dashboard-container">
            <ScraperControl
                onTrigger={handleScrapeTrigger}
                autoScrapeEnabled={true}
                isSystemBusy={isScanning}
            />

            <header className="dashboard-header">
                <h1>Sneaker Monitor 👟</h1>

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
                        <p className="stat-value small" title={currentSearchTerm}>{currentSearchTerm || 'Unknown'}</p>
                    </div>
                </div>
            </header>

            <main className="results-grid">
                {loading ? (
                    <div className="empty-state">
                        <div className="spinner-small"></div>
                        <span>Loading Data...</span>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="empty-state">
                        {isScanning ? (
                            <>
                                <div className="spinner-small"></div>
                                <span>Scanning stores for "{currentSearchTerm}"...</span>
                            </>
                        ) : (
                            <>
                                <span>No matches found for "{searchQuery || currentSearchTerm}"</span>
                            </>
                        )}
                    </div>
                ) : (
                    filteredResults.map((item) => (
                        <ShoeCard key={item.link || item.id} item={item} />
                    ))
                )}
            </main>
        </div>
    );
};

export default Dashboard;
