export interface MapLegendItem {
    color: string;
    label: string;
}

export interface MapLegendProps {
    title?: string;
    items?: MapLegendItem[];
}

declare const MapLegend: (props: MapLegendProps) => JSX.Element;
export default MapLegend;
