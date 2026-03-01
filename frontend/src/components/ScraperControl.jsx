import React, { useState, useEffect } from 'react';
import taxonomyData from '../data/sneaker_models.json';
import { supabase } from '../supabaseClient';

const REPO = 'idobahir78/SneakerMonitor';
const WORKFLOW_FILE = 'scrape.yml';

const ScraperControl = ({ onTrigger, isSystemBusy = false, isScheduled = false, onToggleSchedule }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [token, setToken] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customBrand, setCustomBrand] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [sizes, setSizes] = useState('*');
    const [status, setStatus] = useState(null);
    const [message, setMessage] = useState('');
    const [showBusyOverlay, setShowBusyOverlay] = useState(false);
    const [taxonomy, setTaxonomy] = useState(taxonomyData);

    const fetchCustomTaxonomy = async () => {
        if (!supabase) return taxonomyData;
        try {
            const { data, error } = await supabase.from('custom_taxonomy').select('*');
            if (!error && data && data.length > 0) {
                const merged = JSON.parse(JSON.stringify(taxonomyData)); // deep copy
                data.forEach(item => {
                    let brandObj = merged.brands.find(b => b.brand_name.toLowerCase() === item.brand.toLowerCase());
                    if (brandObj) {
                        if (!brandObj.models.includes(item.model)) brandObj.models.push(item.model);
                    } else {
                        merged.brands.push({ brand_name: item.brand, models: [item.model] });
                    }
                });
                merged.brands.sort((a, b) => a.brand_name.localeCompare(b.brand_name));
                merged.brands.forEach(b => b.models.sort((x, y) => x.localeCompare(y)));
                setTaxonomy(merged);
                return merged;
            }
        } catch (err) { }
        return taxonomyData;
    };

    useEffect(() => {
        const loadInitialData = async () => {
            const activeTaxonomy = await fetchCustomTaxonomy();

            const savedToken = localStorage.getItem('gh_pat');
            if (savedToken) setToken(savedToken);

            const savedSizes = localStorage.getItem('scraper_sizes');
            if (savedSizes) setSizes(savedSizes);

            const savedBrand = localStorage.getItem('scraper_brand');
            const savedModel = localStorage.getItem('scraper_model');
            const savedCustomBrand = localStorage.getItem('scraper_custom_brand');
            const savedCustomModel = localStorage.getItem('scraper_custom_model');
            const savedMode = localStorage.getItem('scraper_is_custom') === 'true';

            if (savedBrand) {
                const brandInfo = activeTaxonomy.brands.find(b => b.brand_name === savedBrand);
                if (brandInfo) {
                    setSelectedBrand(savedBrand);
                    if (savedModel && brandInfo.models.includes(savedModel)) {
                        setSelectedModel(savedModel);
                    }
                }
            }
            if (savedCustomBrand) setCustomBrand(savedCustomBrand);
            if (savedCustomModel) setCustomModel(savedCustomModel);
            setIsCustomMode(savedMode);

            if (!savedBrand && !savedCustomBrand) {
                const oldSearch = localStorage.getItem('scraper_search');
                if (oldSearch) {
                    // very basic fallback if transitioning from old manual string
                    setCustomBrand(oldSearch.split(' ')[0] || '');
                    setCustomModel(oldSearch.split(' ').slice(1).join(' ') || '');
                    setIsCustomMode(true);
                }
            }
        };
        loadInitialData();
    }, []);

    const prevBusyRef = React.useRef(isSystemBusy);
    useEffect(() => {
        if (prevBusyRef.current === true && isSystemBusy === false) {
            // System just finished scanning! Auto-refresh the learned taxonomy.
            fetchCustomTaxonomy();
        }
        prevBusyRef.current = isSystemBusy;
    }, [isSystemBusy]);

    const saveSettings = () => {
        if (token) localStorage.setItem('gh_pat', token);
        localStorage.setItem('scraper_sizes', sizes);
        localStorage.setItem('scraper_brand', selectedBrand);
        localStorage.setItem('scraper_model', selectedModel);
        localStorage.setItem('scraper_custom_brand', customBrand);
        localStorage.setItem('scraper_custom_model', customModel);
        localStorage.setItem('scraper_is_custom', isCustomMode);
        setMessage('Settings saved!');
        setTimeout(() => setMessage(''), 2000);
    };

    const getFinalSearchTerm = () => {
        if (isCustomMode) {
            if (customBrand && customModel) return `${customBrand} ${customModel}`;
            if (customBrand) return customBrand;
            return '';
        }
        if (selectedBrand && selectedModel) return `${selectedBrand} ${selectedModel}`;
        if (selectedBrand) return selectedBrand;
        return '';
    };

    const handleToggleScheduler = () => {
        if (onToggleSchedule) {
            onToggleSchedule();
            setMessage(!isScheduled ? 'Daily search activated ✅' : 'Daily search paused ⏸');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const dispatchWorkflow = async (inputs = {}) => {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `token ${token}` } : {}),
        };
        return fetch(
            `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
            { method: 'POST', headers, body: JSON.stringify({ ref: 'main', inputs }) }
        );
    };

    const triggerScrape = async () => {
        if (isSystemBusy) {
            setShowBusyOverlay(true);
            return;
        }

        const termToScrape = getFinalSearchTerm();

        if (!token) {
            setStatus('error');
            setMessage('Please enter your GitHub Token first.');
            return;
        }
        if (!termToScrape) {
            setStatus('error');
            setMessage('Please select a model or enter a search term.');
            return;
        }

        saveSettings();

        setStatus('loading');
        setMessage(`Triggering scan for "${termToScrape}"...`);

        try {
            const searchId = crypto.randomUUID();
            localStorage.setItem('currentSearchId', searchId);

            const response = await dispatchWorkflow({
                search_term: termToScrape,
                sizes: sizes,
                search_id: searchId
            });

            if (response.ok || response.status === 204) {
                setStatus('success');
                setMessage('Scan started! 🚀 Auto-scan paused until you resume it.');
                if (onTrigger) onTrigger({ progressiveMode: true, searchTerm: termToScrape, searchId: searchId });
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

    const currentBrandInfo = taxonomy.brands.find(b => b.brand_name === selectedBrand);
    const availableModels = currentBrandInfo ? currentBrandInfo.models : [];

    return (
        <>
            {showBusyOverlay && (
                <div className="busy-overlay" onClick={() => setShowBusyOverlay(false)}>
                    <div className="busy-modal" onClick={e => e.stopPropagation()}>
                        <div className="busy-icon">🚨</div>
                        <h3>System Busy</h3>
                        <p>A scheduled search is currently active. Manual search is disabled to prevent data corruption.</p>
                        <button className="busy-close-btn" onClick={() => setShowBusyOverlay(false)}>Got it</button>
                    </div>
                </div>
            )}

            <div className="scraper-control-panel">
                <div className="control-header">
                    <h3>Remote Control 🎮</h3>
                    <button onClick={() => setIsOpen(false)} className="close-btn">×</button>
                </div>

                <div className="control-group">
                    <label>GitHub Token</label>
                    <div className="token-input-wrapper">
                        <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_..."
                        />
                    </div>
                    <small className="hint">Saved locally in your browser only. Never sent to our servers.</small>
                </div>

                <div className="control-group">
                    <div className="label-row">
                        <label>Search For</label>
                        <button
                            className="text-btn small"
                            onClick={() => setIsCustomMode(!isCustomMode)}
                        >
                            {isCustomMode ? 'Switch to List' : '+ Add Custom Brand/Model'}
                        </button>
                    </div>

                    {isCustomMode ? (
                        <div className="custom-input-group" style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={customBrand}
                                onChange={(e) => setCustomBrand(e.target.value)}
                                placeholder="Brand (e.g. Puma)"
                                style={{ flex: 1 }}
                            />
                            <input
                                type="text"
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value)}
                                placeholder="Model (e.g. MB.04)"
                                style={{ flex: 1 }}
                            />
                        </div>
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
                                {taxonomy.brands.map(brandObj => (
                                    <option key={brandObj.brand_name} value={brandObj.brand_name}>
                                        {brandObj.brand_name}
                                    </option>
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
                    <button
                        className="scheduler-toggle-btn"
                        onClick={handleToggleScheduler}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: isScheduled ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)',
                            color: isScheduled ? '#4CAF50' : '#FF9800',
                            border: `1px solid ${isScheduled ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'}`,
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {isScheduled ? '✅ Daily Search: ON (Scheduled)' : '⏸ Daily Search: PAUSED'}
                    </button>
                    <small className="hint" style={{ display: 'block', marginTop: '5px' }}>
                        Searches automatically every day at 08:00 AM using this phrase and saves results to your account.
                    </small>
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
        </>
    );
};

export default ScraperControl;
