import React, { useState, useEffect } from 'react';

const ScraperControl = ({ onTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [token, setToken] = useState('');
    const [searchTerm, setSearchTerm] = useState('MB.05, MB.04, MB.03, LaMelo, Wade, LeBron, Freak');
    const [sizes, setSizes] = useState('*');
    const [status, setStatus] = useState(null); // 'loading', 'success', 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        const savedToken = localStorage.getItem('github_pat');
        if (savedToken) setToken(savedToken);

        const savedSearch = localStorage.getItem('scraper_search');
        if (savedSearch) setSearchTerm(savedSearch);

        const savedSizes = localStorage.getItem('scraper_sizes');
        if (savedSizes) setSizes(savedSizes);
    }, []);

    const saveSettings = () => {
        localStorage.setItem('github_pat', token);
        localStorage.setItem('scraper_search', searchTerm);
        localStorage.setItem('scraper_sizes', sizes);
        setMessage('Settings saved!');
        setTimeout(() => setMessage(''), 2000);
    };

    const triggerScrape = async () => {
        if (!token) {
            setStatus('error');
            setMessage('Please enter a GitHub Token first.');
            return;
        }

        // Auto-save settings
        localStorage.setItem('scraper_search', searchTerm);
        localStorage.setItem('scraper_sizes', sizes);

        setStatus('loading');
        setMessage('Triggering robot...');

        try {
            const response = await fetch(`https://api.github.com/repos/idobahir78/SneakerMonitor/actions/workflows/scrape.yml/dispatches`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        search_term: searchTerm,
                        sizes: sizes
                    }
                })
            });

            if (response.ok) {
                setStatus('success');
                setMessage('Scrape started! Update in ~5 mins.');
                if (onTrigger) onTrigger();
            } else {
                const errText = await response.text();
                throw new Error(`Failed: ${response.status} ${errText}`);
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage(err.message);
        }
    };

    if (!isOpen) {
        return (
            <button
                className="control-toggle-btn"
                onClick={() => setIsOpen(true)}
                title="Open Scraper Settings"
            >
                ⚙️
            </button>
        );
    }

    return (
        <div className="scraper-control-panel">
            <div className="control-header">
                <h3>Remote Control 🎮</h3>
                <button onClick={() => setIsOpen(false)} className="close-btn">×</button>
            </div>

            <div className="control-group">
                <label>GitHub Token (PAT)</label>
                <div className="token-input-wrapper">
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_..."
                    />
                    <button onClick={saveSettings} className="save-btn">Save Settings</button>
                </div>
                <small className="hint">Required for acting as you.</small>
            </div>

            <div className="control-group">
                <label>Search Models</label>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="control-group">
                <label>Sizes</label>
                <input
                    type="text"
                    value={sizes}
                    onChange={(e) => setSizes(e.target.value)}
                />
            </div>

            <button
                className={`trigger-btn ${status}`}
                onClick={triggerScrape}
                disabled={status === 'loading'}
            >
                {status === 'loading' ? 'Sending...' : 'Start Scrape 🚀'}
            </button>

            {message && <div className={`status-message ${status}`}>{message}</div>}
        </div>
    );
};

export default ScraperControl;
