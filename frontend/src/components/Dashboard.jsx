
import React, { useState, useEffect } from 'react';
import ShoeCard from './ShoeCard';

import ScraperControl from './ScraperControl';

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshFlash, setRefreshFlash] = useState(false);

    const fetchData = () => {
        fetch('data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Data file not found (run scraper first!)');
                }
                return response.json();
            })
            .then(jsonData => {
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

        // Auto-refresh every 60 seconds
        const interval = setInterval(() => {
            fetchData();
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="loading-screen">Loading Monitor...</div>;
    if (error) return <div className="error-screen">Error: {error}</div>;
    if (!data) return <div className="error-screen">No Data Available</div>;

    const { results, updatedAt, searchTerm } = data;

    // Filter results based on client-side search
    const filteredResults = results.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.store.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Calculate Stats
    const totalFound = filteredResults.length;
    const lowestPrice = filteredResults.reduce((min, item) => (item.price < min ? item.price : min), Infinity);
    const bestPriceDisplay = totalFound > 0 ? `₪${lowestPrice}` : '-';

    // Format Date
    const lastUpdated = new Date(updatedAt).toLocaleString();

    return (
        <div className="dashboard-container">
            <ScraperControl onTrigger={() => console.log('Scrape triggered via UI')} />

            <header className="dashboard-header">
                <h1>Sneaker Monitor 👟</h1>
                <p className={`last-updated ${refreshFlash ? 'flash-update' : ''}`}>
                    Last Updated: {lastUpdated}
                    <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }}>
                        (↻ Auto-refresh on)
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
                        No matches found for "{searchQuery}"
                        <br />
                        (Scraped for: {searchTerm})
                    </div>
                ) : (
                    filteredResults.map((item, index) => (
                        <ShoeCard key={index} item={item} />
                    ))
                )}
            </main>
        </div>
    );
};

export default Dashboard;
