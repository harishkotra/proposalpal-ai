import React from 'react';
import './Badge.css';

const Badge = ({ badge, showDescription = false, size = 'medium' }) => {
    const tierColors = {
        bronze: '#cd7f32',
        silver: '#c0c0c0',
        gold: '#ffd700',
        platinum: '#e5e4e2'
    };

    return (
        <div className={`badge-item badge-${size}`} title={badge.description}>
            <div
                className="badge-icon"
                style={{ borderColor: tierColors[badge.tier] }}
            >
                <span className="badge-emoji">{badge.icon}</span>
            </div>
            <div className="badge-info">
                <div className="badge-name">{badge.name}</div>
                {showDescription && (
                    <div className="badge-description">{badge.description}</div>
                )}
            </div>
        </div>
    );
};

export default Badge;
