export interface ZoneLayerProps {
    id: string;
    sourceId: string;
    beforeId?: string;
}

export interface ZoneFillLayerProps extends ZoneLayerProps {
    fillColor?: string;
    fillOpacity?: number;
}

export interface ZoneOutlineLayerProps extends ZoneLayerProps {
    lineColor?: string;
    lineOpacity?: number;
    lineWidth?: number;
}

export interface ZoneSelectionLayerProps extends ZoneLayerProps {
    selectedIds?: Array<string | number>;
    fillColor?: string;
    fillOpacity?: number;
}

export interface HeatmapStop {
    value: number;
    color: string;
}

export interface ZoneHeatmapLayerProps extends ZoneLayerProps {
    property: string;
    propertyPath?: string[];
    stops: HeatmapStop[];
    fillOpacity?: number;
}

export declare const ZoneFillLayer: (props: ZoneFillLayerProps) => JSX.Element;
export declare const ZoneOutlineLayer: (props: ZoneOutlineLayerProps) => JSX.Element;
export declare const ZoneSelectionLayer: (props: ZoneSelectionLayerProps) => JSX.Element;
export declare const ZoneHeatmapLayer: (props: ZoneHeatmapLayerProps) => JSX.Element;
