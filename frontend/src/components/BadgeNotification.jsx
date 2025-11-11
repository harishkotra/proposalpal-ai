import React, { useEffect, useState } from 'react';
import Badge from './Badge';
import './BadgeNotification.css';

const BadgeNotification = ({ badges, onClose }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (badges && badges.length > 0) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onClose, 300); // Wait for fade out animation
            }, 5000); // Show for 5 seconds

            return () => clearTimeout(timer);
        }
    }, [badges, onClose]);

    if (!badges || badges.length === 0) return null;

    return (
        <div className={`badge-notification ${visible ? 'visible' : ''}`}>
            <div className="badge-notification-header">
                <h4>New Badge{badges.length > 1 ? 's' : ''} Earned!</h4>
                <button
                    className="close-button"
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    aria-label="Close notification"
                >
                    ×
                </button>
            </div>
            <div className="badge-notification-content">
                {badges.map((badge, index) => (
                    <Badge
                        key={index}
                        badge={badge}
                        showDescription={true}
                        size="medium"
                    />
                ))}
            </div>
        </div>
    );
};

export default BadgeNotification;
