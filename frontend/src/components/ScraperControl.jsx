import React, { useState, useEffect } from 'react';
import BRANDS_DATA from '../data/brands';

const REPO = 'idobahir78/SneakerMonitor';
const WORKFLOW_FILE = 'scrape.yml';
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

const ScraperControl = ({ onTrigger, autoScrapeEnabled = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualSearchTerm, setManualSearchTerm] = useState('');
    const [sizes, setSizes] = useState('*');
    const [isAutoEnabled, setIsAutoEnabled] = useState(autoScrapeEnabled);
    const [status, setStatus] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const savedSizes = localStorage.getItem('scraper_sizes');
        if (savedSizes) setSizes(savedSizes);

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

        if (!savedBrand && !savedManual) {
            const oldSearch = localStorage.getItem('scraper_search');
            if (oldSearch) {
                setManualSearchTerm(oldSearch);
                setIsManualMode(true);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof autoScrapeEnabled !== 'undefined') {
            setIsAutoEnabled(autoScrapeEnabled);
        }
    }, [autoScrapeEnabled]);

    const saveSettings = () => {
        localStorage.setItem('scraper_sizes', sizes);
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

    const dispatchWorkflow = async (inputs = {}) => {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        };
        if (TOKEN) headers['Authorization'] = `token ${TOKEN}`;

        return fetch(
            `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
            { method: 'POST', headers, body: JSON.stringify({ ref: 'main', inputs }) }
        );
    };

    const triggerScrape = async () => {
        const termToScrape = getFinalSearchTerm();

        if (!termToScrape) {
            setStatus('error');
            setMessage('Please select a model or enter a search term.');
            return;
        }

        saveSettings();
        setStatus('loading');
        setMessage(`Triggering scan for "${termToScrape}"...`);

        try {
            const response = await dispatchWorkflow({
                search_term: termToScrape,
                sizes: sizes,
            });

            if (response.ok || response.status === 204) {
                setStatus('success');
                setMessage('Scan started! 🚀 Results stream in shortly.');
                if (onTrigger) onTrigger({ progressiveMode: true, searchTerm: termToScrape });
            } else {
                const errText = await response.text();
                throw new Error(`GitHub API: ${response.status} — ${errText}`);
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
                <div className="label-row">
                    <label>Search For</label>
                    <button
                        className="text-btn small"
                        onClick={() => setIsManualMode(!isManualMode)}
                    >
                        {isManualMode ? 'Switch to List' : 'Switch to Manual'}
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
                                setSelectedModel('');
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

            <div className="control-group">
                <div
                    className="auto-status-pill"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: isAutoEnabled ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)',
                        color: isAutoEnabled ? '#4CAF50' : '#FF9800',
                        border: `1px solid ${isAutoEnabled ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'}`,
                    }}
                >
                    {isAutoEnabled ? '⏱ Hourly Auto-Scan: ON' : '⏸ Hourly Auto-Scan: PAUSED'}
                </div>
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
