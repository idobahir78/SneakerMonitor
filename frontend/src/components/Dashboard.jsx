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
    const [isScheduled, setIsScheduled] = useState(false);
    const [sortBy, setSortBy] = useState('price-asc');
    const lastToggleTimeRef = React.useRef(0);

    useEffect(() => {
        fetchData(); // Initial load

        // Dynamic refresh interval: 3s when scanning, 30s when idle
        const interval = setInterval(() => {
            fetchData();
        }, isScanning ? 3000 : 30000);

        return () => clearInterval(interval);
    }, [isScanning]); // Re-create interval when scanning status changes

    const fetchData = async () => {
        setError(null);

        if (!supabase) {
            setError("🔴 Database Connection Missing: Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Netlify Environment Variables, and redeploy the site.");
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch System State
            let currentSearchId = localStorage.getItem('currentSearchId');
            if (!currentSearchId) {
                // Generate a persistent ID for this user browser so they can toggle scheduled searches 
                // even before running their first manual scan.
                currentSearchId = crypto.randomUUID();
                localStorage.setItem('currentSearchId', currentSearchId);
            }
            const { data: stateData, error: stateError } = await supabase
                .from('search_jobs')
                .select('*')
                .eq('id', currentSearchId)
                .maybeSingle();

            if (stateError) throw stateError;

            const triggerTime = lastTriggerTime || parseInt(localStorage.getItem('lastTriggerTime') || '0');
            const now = Date.now();

            // Safety Timeout: if local manual search for > 5 minutes, force Idle
            const isStuck = triggerTime > 0 && (now - triggerTime > 300000);

            let stillScanning = false;

            if (stateData) {
                // If the backend has processed or is processing this row
                stillScanning = stateData.is_scanning;
            } else {
                // Row doesn't exist yet (Github Action booting)
                if (currentSearchId !== 'scheduled_system_run' && triggerTime > 0 && !isStuck) {
                    stillScanning = true;
                }
            }

            // Fallback: if stuck, stop polling UI
            if (isStuck) {
                stillScanning = false;
            }

            setIsScanning(stillScanning);

            // 2. Fetch Products
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('*')
                .eq('search_id', currentSearchId)
                .order('created_at', { ascending: false });

            if (productsError) throw productsError;

            // Map DB schema to frontend ShoeCard schema
            let mappedProducts = (productsData || []).map(p => ({
                id: p.id,
                title: `${p.brand} ${p.model}`,
                price: p.price,
                store: p.site,
                link: p.product_url,
                image_url: p.image_url,
                sizes: (() => {
                    try {
                        return typeof p.sizes === 'string' ? JSON.parse(p.sizes) : (p.sizes || []);
                    } catch (e) {
                        return [];
                    }
                })()
            }));

            // We no longer need isStale to clear mappedProducts because the DB natively 
            // keeps isolated searches via currentSearchId! It naturally returns [] on boot.

            const newDataState = {
                products: mappedProducts,
                isScanning: stillScanning,
                lastUpdate: stateData?.last_run || new Date().toISOString()
            };

            // Detect new updates
            const productsChanged = JSON.stringify(newDataState.products) !== JSON.stringify(data.products);
            const statusChanged = data.isScanning !== stillScanning;

            if (productsChanged || statusChanged) {
                setData(newDataState);
                if (productsChanged) {
                    setRefreshFlash(true);
                    setTimeout(() => setRefreshFlash(false), 2000);
                }
            } else if (stillScanning && data.products.length === 0) {
                // Ensure UI shows scanning state cleanly
                setData(newDataState);
            }

            // Sync the scheduled toggle state (skip if just toggled to avoid data races with 3s polling)
            if (Date.now() - lastToggleTimeRef.current > 5000) {
                if (stateData && stateData.is_scheduled !== undefined) {
                    setIsScheduled(!!stateData.is_scheduled);
                } else {
                    setIsScheduled(false);
                }
            }

            setLoading(false);
        } catch (err) {
            console.error("Error fetching from Supabase:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const toggleSchedule = async () => {
        if (!supabase) return;
        let currentSearchId = localStorage.getItem('currentSearchId');
        if (!currentSearchId) {
            currentSearchId = crypto.randomUUID();
            localStorage.setItem('currentSearchId', currentSearchId);
        }

        const newStatus = !isScheduled;
        lastToggleTimeRef.current = Date.now();
        setIsScheduled(newStatus); // Optimistic UI update

        try {
            const { error } = await supabase
                .from('search_jobs')
                .upsert({
                    id: currentSearchId,
                    is_scheduled: newStatus,
                    // Store the current search terms so the cron job knows what to run!
                    search_term: triggeredSearchTerm || localStorage.getItem('scraper_manual_term') || localStorage.getItem('scraper_brand') || 'Nike',
                    size_filter: localStorage.getItem('scraper_sizes') || '*',
                    last_run: new Date().toISOString()
                });

            if (error) throw error;
        } catch (err) {
            console.error("Error toggling schedule:", err);
            setIsScheduled(!newStatus); // Revert on failure
            alert(`Failed: ${err.message || JSON.stringify(err)}`);
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

    const sortedResults = [...filteredResults].sort((a, b) => {
        if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'store-asc') return (a.store || '').localeCompare(b.store || '');
        return 0;
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
        const searchId = options.searchId;

        setLastTriggerTime(now);
        setTriggeredSearchTerm(newSearchTerm);
        setIsScanning(true);

        localStorage.setItem('lastTriggerTime', now.toString());
        localStorage.setItem('triggeredSearchTerm', newSearchTerm);
        if (searchId) localStorage.setItem('currentSearchId', searchId);

        // Flash UI to scanning state immediately
        setData({ products: [], isScanning: true, lastUpdate: new Date().toISOString() });
        setTimeout(() => fetchData(), 5000);
    };

    return (
        <div className="dashboard-container">
            <ScraperControl
                onTrigger={handleScrapeTrigger}
                isSystemBusy={isScanning}
                isScheduled={isScheduled}
                onToggleSchedule={toggleSchedule}
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

                <div className="search-bar-container" style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search model, store..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                        style={{ flex: 1 }}
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="search-input"
                        style={{ width: 'auto', flex: 'none', cursor: 'pointer' }}
                    >
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="store-asc">Store: A to Z</option>
                    </select>
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
                ) : sortedResults.length === 0 ? (
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
                    sortedResults.map((item) => (
                        <ShoeCard key={item.link || item.id} item={item} />
                    ))
                )}
            </main>
        </div>
    );
};

export default Dashboard;
