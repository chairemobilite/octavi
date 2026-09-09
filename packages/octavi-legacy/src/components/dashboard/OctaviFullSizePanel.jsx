import React from 'react';

import OctaviHighlights from './panels/OctaviHighlights';
import OctaviMaps from './panels/OctaviMaps';
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import serviceLocator    from "chaire-lib-common/lib/utils/ServiceLocator";

const FullSizePanel = (props) => {

    const [dataSourceCollection, setDataSourceCollection] = React.useState(serviceLocator.collectionManager.get('dataSources'));

    React.useEffect(() => {
        const onDataSourceCollectionUpdate = () =>
            setDataSourceCollection(serviceLocator.collectionManager.get('dataSources'));

        serviceLocator.eventManager.on('collection.update.dataSources', onDataSourceCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.dataSources', onDataSourceCollectionUpdate);
        }
    }, []);

    if (dataSourceCollection === undefined) {
        return <LoadingPage />;
    }

    return (
        <section id="tr__full-size-panel">
            {props.activeSection === 'octaviHighlights' &&
                <OctaviHighlights
                    activeSection = {props.activeSection}
                />
            }
            {props.activeSection === 'octaviMap' &&
                <OctaviMaps
                    activeSection = {props.activeSection}
                />
            }
        </section>
    );
};

export default FullSizePanel;
