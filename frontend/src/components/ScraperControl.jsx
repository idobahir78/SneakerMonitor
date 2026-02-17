import React, { useState, useEffect } from 'react';
import BRANDS_DATA from '../data/brands';

const ScraperControl = ({ onTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [token, setToken] = useState('');

    // UI State for Brand/Model Selector
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualSearchTerm, setManualSearchTerm] = useState('');

    const [sizes, setSizes] = useState('*');
    const [progressiveUpdates, setProgressiveUpdates] = useState(false); // NEW: Progressive mode toggle
    const [status, setStatus] = useState(null); // 'loading', 'success', 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        const savedToken = localStorage.getItem('github_pat');
        if (savedToken) setToken(savedToken);

        const savedSizes = localStorage.getItem('scraper_sizes');
        if (savedSizes) setSizes(savedSizes);

        // Load progressive mode preference
        const savedProgressive = localStorage.getItem('scraper_progressive_updates') === 'true';
        setProgressiveUpdates(savedProgressive);

        // Load saved selections
        const savedBrand = localStorage.getItem('scraper_brand');
        const savedModel = localStorage.getItem('scraper_model');
        const savedManual = localStorage.getItem('scraper_manual_term');
        const savedMode = localStorage.getItem('scraper_is_manual') === 'true';

        if (savedBrand && BRANDS_DATA[savedBrand]) {
            setSelectedBrand(savedBrand);
            if (savedModel) setSelectedModel(savedModel);
        }
        if (savedManual) setManualSearchTerm(savedManual);
        setIsManualMode(savedMode);

        // Fallback: If no structured data saved but old 'scraper_search' exists, use it as manual
        if (!savedBrand && !savedManual) {
            const oldSearch = localStorage.getItem('scraper_search');
            if (oldSearch) {
                setManualSearchTerm(oldSearch);
                setIsManualMode(true);
            }
        }
    }, []);

    const saveSettings = () => {
        localStorage.setItem('github_pat', token);
        localStorage.setItem('scraper_sizes', sizes);
        localStorage.setItem('scraper_progressive_updates', progressiveUpdates);

        localStorage.setItem('scraper_brand', selectedBrand);
        localStorage.setItem('scraper_model', selectedModel);
        localStorage.setItem('scraper_manual_term', manualSearchTerm);
        localStorage.setItem('scraper_is_manual', isManualMode);

        setMessage('Settings saved!');
        setTimeout(() => setMessage(''), 2000);
    };

    const getFinalSearchTerm = () => {
        if (isManualMode) return manualSearchTerm;
        if (selectedBrand && selectedModel) return `${selectedBrand} ${selectedModel}`;
        if (selectedBrand) return selectedBrand;
        return '';
    };

    const triggerScrape = async () => {
        const termToScrape = getFinalSearchTerm();

        if (!token) {
            setStatus('error');
            setMessage('Please enter a GitHub Token first.');
            return;
        }

        if (!termToScrape) {
            setStatus('error');
            setMessage('Please select a model or enter a search term.');
            return;
        }

        // Auto-save settings
        saveSettings();

        setStatus('loading');
        setMessage(`Triggering robot for "${termToScrape}"...`);

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
                        search_term: termToScrape,
                        sizes: sizes,
                        progressive_updates: progressiveUpdates ? 'true' : 'false'
                    }
                })
            });

            if (response.ok) {
                setStatus('success');
                setMessage('Scrape started! Update in ~5 mins.');

                // Notify parent that scrape started
                if (onTrigger) onTrigger({
                    progressiveMode: progressiveUpdates,
                    searchTerm: termToScrape
                });
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

    const availableModels = selectedBrand ? BRANDS_DATA[selectedBrand] : [];

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
                </div>
                <small className="hint">Required for acting as you.</small>
            </div>

            <div className="control-group">
                <div className="label-row">
                    <label>Search For</label>
                    <button
                        className="text-btn small"
                        onClick={() => setIsManualMode(!isManualMode)}
                    >
                        {isManualMode ? "Switch to List" : "Switch to Manual"}
                    </button>
                </div>

                {isManualMode ? (
                    <input
                        type="text"
                        value={manualSearchTerm}
                        onChange={(e) => setManualSearchTerm(e.target.value)}
                        placeholder="e.g. Nike Air Max"
                    />
                ) : (
                    <div className="select-group">
                        <select
                            value={selectedBrand}
                            onChange={(e) => {
                                setSelectedBrand(e.target.value);
                                setSelectedModel(''); // Reset model on brand change
                            }}
                        >
                            <option value="">Select Brand...</option>
                            {Object.keys(BRANDS_DATA).map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>

                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={!selectedBrand || availableModels.length === 0}
                        >
                            <option value="">Select Model...</option>
                            {availableModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="control-group">
                <label>Sizes</label>
                <input
                    type="text"
                    value={sizes}
                    onChange={(e) => setSizes(e.target.value)}
                    placeholder="e.g. 42, 43 or *"
                />
            </div>

            <div className="control-group checkbox-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={progressiveUpdates}
                        onChange={(e) => setProgressiveUpdates(e.target.checked)}
                    />
                    <span>Progressive Updates (Real-time) 🔄</span>
                </label>
                <small className="hint">See results appear live as they're found (slower, but exciting!)</small>
            </div>

            <div className="action-row">
                <button onClick={saveSettings} className="save-btn">Save</button>
                <button
                    className={`trigger-btn ${status}`}
                    onClick={triggerScrape}
                    disabled={status === 'loading'}
                >
                    {status === 'loading' ? 'Sending...' : 'Start Scrape 🚀'}
                </button>
            </div>

            {message && <div className={`status-message ${status}`}>{message}</div>}
        </div>
    );
};

export default ScraperControl;
