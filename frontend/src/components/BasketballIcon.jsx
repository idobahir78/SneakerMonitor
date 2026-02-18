import React from 'react';

const BasketballIcon = ({ className }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className={className}
        >
            <circle cx="256" cy="256" r="246" fill="#D85A1C" />
            <path fill="none" stroke="#231F20" strokeWidth="18" d="M256,10C119.8,10,10,119.8,10,256s109.8,246,246,246s246-109.8,246-246S392.2,10,256,10z" />
            <path fill="none" stroke="#231F20" strokeWidth="18" d="M256,10c0,0,0,492,0,492" />
            <path fill="none" stroke="#231F20" strokeWidth="18" d="M10,256c0,0,492,0,492,0" />
            <path fill="none" stroke="#231F20" strokeWidth="18" d="M430,90c-70,60-70,160-70,166s0,106,70,166" />
            <path fill="none" stroke="#231F20" strokeWidth="18" d="M82,90c70,60,70,160,70,166s0,106-70,166" />
            {/* Highlights for 3D effect */}
            <circle cx="256" cy="256" r="246" fill="url(#grad1)" opacity="0.4" style={{ mixBlendMode: 'overlay' }} />
            <defs>
                <radialGradient id="grad1" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.5 }} />
                    <stop offset="100%" style={{ stopColor: 'black', stopOpacity: 0.2 }} />
                </radialGradient>
            </defs>
        </svg>
    );
};

export default BasketballIcon;
