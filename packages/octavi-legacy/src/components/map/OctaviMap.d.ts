import type { ComponentProps, ReactNode } from 'react';
import MapLibreMap, { Popup } from 'react-map-gl/maplibre';

type MapProps = ComponentProps<typeof MapLibreMap>;

export interface OctaviMapProps extends Omit<MapProps, 'children' | 'mapStyle'> {
    center?: [number, number];
    zoom?: number;
    mapStyle?: MapProps['mapStyle'];
    children?: ReactNode;
}

declare const OctaviMap: (props: OctaviMapProps) => JSX.Element;

export { MapLibreMap as OctaviMapLibre, Popup };
export default OctaviMap;
