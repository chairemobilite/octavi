import type { ReactNode } from 'react';
import type { FeatureCollection } from 'geojson';

export interface ZoneMapSourceProps {
    id: string;
    data: FeatureCollection;
    children?: ReactNode;
}

declare const ZoneMapSource: (props: ZoneMapSourceProps) => JSX.Element;
export default ZoneMapSource;
