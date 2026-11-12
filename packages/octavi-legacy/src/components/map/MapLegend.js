import React from 'react';

const MapLegend = ({ title, items = [] }) => (
    <div className="map-overlay octavi-map-legend" aria-label={title}>
        {title && <div className="_center octavi-map-legend__title">{title}</div>}
        {items.map((item, index) => (
            <div className="octavi-map-legend__item" key={`${item.label}-${index}`}>
                <span className="legend-key" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
            </div>
        ))}
    </div>
);

export default MapLegend;
