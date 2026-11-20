import React from 'react';

import OctaviHighlights from 'octavi-legacy/lib/components/dashboard/panels/OctaviHighlights';
import OctaviMapPanel from '../sections/octaviMaps/OctaviMapPanel';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';

const FullSizePanel = (props: LayoutSectionProps) => {
    const [dataSourceCollection, setDataSourceCollection] = React.useState(
        serviceLocator.collectionManager.get('dataSources')
    );

    React.useEffect(() => {
        const onDataSourceCollectionUpdate = () =>
            setDataSourceCollection(serviceLocator.collectionManager.get('dataSources'));

        serviceLocator.eventManager.on('collection.update.dataSources', onDataSourceCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.dataSources', onDataSourceCollectionUpdate);
        };
    }, []);

    if (dataSourceCollection === undefined) {
        return <LoadingPage />;
    }

    return (
        <section id="tr__full-size-panel">
            {props.activeSection === 'octaviHighlights' && <OctaviHighlights activeSection={props.activeSection} />}
            {props.activeSection === 'octaviMap' && <OctaviMapPanel />}
        </section>
    );
};

export default FullSizePanel;
