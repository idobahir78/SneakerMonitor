
import React from 'react';

const ShoeCard = ({ item }) => {
    // Support both new schema (display_title, price_ils, buy_link, store_name)
    // and legacy schema (title, price, link, store) for backward compatibility
    const storeName = item.store_name || item.store || 'Unknown';
    const displayTitle = item.display_title || item.title || 'Unknown';
    const buyLink = item.buy_link || item.link || '#';
    const imageUrl = item.image_url || item.image || null;
    const badges = item.badges || [];

    const priceNum = parseFloat(item.price_ils ?? item.price);
    const formattedPrice = (priceNum && !isNaN(priceNum) && priceNum > 0)
        ? `₪${priceNum.toFixed(2)}`
        : 'Check Site';

    const hasBestPrice = badges.includes('Best Price');

    return (
        <div className={`shoe-card ${hasBestPrice ? 'best-price-card' : ''}`}>
            {/* Product Image */}
            {imageUrl && (
                <div className="card-image-wrap">
                    <img
                        src={imageUrl}
                        alt={displayTitle}
                        className="card-image"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {hasBestPrice && (
                        <span className="best-price-badge">🏆 Best Price</span>
                    )}
                </div>
            )}

            <div className="card-header">
                <span className="store-badge">{storeName}</span>
                <span className="price-tag">{formattedPrice}</span>
            </div>

            <div className="card-body">
                <h3 className="shoe-title" title={displayTitle}>{displayTitle}</h3>

                {/* Badges row */}
                {badges.length > 0 && (
                    <div className="badges-row">
                        {badges.map((badge, i) => (
                            <span key={i} className="badge-pill">{badge}</span>
                        ))}
                    </div>
                )}

                <div className="sizes-container">
                    <span className="sizes-label">Sizes:</span>
                    <div className="sizes-list">
                        {item.sizes && item.sizes.length > 0 ? (
                            item.sizes.map((size, index) => (
                                <span key={index} className="size-chip">{size}</span>
                            ))
                        ) : (
                            <span className="no-sizes visit-site-text">Visit Site to Check</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-footer" onClick={(e) => e.stopPropagation()}>
                <a
                    href={buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="buy-button"
                >
                    Buy Now ↗
                </a>
            </div>
        </div>
    );
};

export default ShoeCard;
