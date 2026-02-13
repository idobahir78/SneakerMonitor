
import React from 'react';

const ShoeCard = ({ item }) => {
    // Extract store name for logo/color coding if needed
    const storeName = item.store || 'Unknown';

    // Basic price formatting
    const formattedPrice = item.price ? `₪${item.price}` : 'Price N/A';

    return (
        <div className="shoe-card">
            <div className="card-header">
                <span className="store-badge">{storeName}</span>
                <span className="price-tag">{formattedPrice}</span>
            </div>

            <div className="card-body">
                <h3 className="shoe-title">{item.title}</h3>

                <div className="sizes-container">
                    <span className="sizes-label">Sizes:</span>
                    <div className="sizes-list">
                        {item.sizes && item.sizes.length > 0 ? (
                            item.sizes.map((size, index) => (
                                <span key={index} className="size-chip">{size}</span>
                            ))
                        ) : (
                            <span className="no-sizes">Checking...</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-footer">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="buy-button">
                    Buy Now ↗
                </a>
            </div>
        </div>
    );
};

export default ShoeCard;
