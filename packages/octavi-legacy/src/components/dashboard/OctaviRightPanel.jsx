import React       from "react";
import PropTypes from "prop-types";
import { useTranslation } from 'react-i18next';

import WidgetManager            from "./panels/OctaviWidgetManager";
import MapScaleManager          from "./panels/OctaviMapScaleManager";
import WidgetManagerSelector    from "./panels/OctaviWidgetManagerSelector";
import MapWidgetManagerSelector from "./panels/OctaviMapWidgetManagerSelector";
import MapScaleManagerSelector  from "./panels/OctaviMapScaleManagerSelector";
import ComparisonPanel          from "./panels/OctaviComparisonPanel";
import FilterExtract            from "./panels/OctaviFilterExtractPanel";
import CalendarPanel            from "./panels/OctaviCalendarPanel";

import TemporalFilterPanel    from "./panels/OctaviTemporalFilterPanel";
import SpatialFilterPanel     from "./panels/OctaviSpatialFilterPanel";
import SpatialFilterMap       from "./panels/OctaviSpatialFilterMapPanel"

import serviceLocator    from "chaire-lib-common/lib/utils/ServiceLocator";
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";

const OctaviRightPanel = (props) => {
    const { t } = useTranslation('octavi');
    const [needSubmit, setNeedSubmit] = React.useState(false);
    const [dataSourceCollection, setDataSourceCollection] = React.useState(serviceLocator.collectionManager.get('dataSources'));

    const onDataSourceCollectionUpdate = () =>
        setDataSourceCollection(serviceLocator.collectionManager.get('dataSources'));

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.dataSources', onDataSourceCollectionUpdate);
        serviceLocator.eventManager.on('taxi.filter.data.update', onFilterChange);
        // Reload the service collections at mount time, to make sure it is up to date
        if (dataSourceCollection !== undefined) {
            dataSourceCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        }
        return () => {
            serviceLocator.eventManager.off('collection.update.dataSources', onDataSourceCollectionUpdate);
            serviceLocator.eventManager.off('taxi.filter.data.update', onFilterChange);
        }
    }, []);

    const onFilterChange = React.useCallback(() => setNeedSubmit(true));

    const onSubmitForm = (e) => {
        e.preventDefault();
        serviceLocator.eventManager.emit('taxi.filter.submit');
        setNeedSubmit(false);
    }

    if (dataSourceCollection === undefined) {
        return <LoadingPage />;
    }

    return (
        <form
            id="tr__form-taxi-activities-calendar"
            className="tr__form-taxi-activities-calendar tr__form"
        >
            <div className="tr__form-section">
                <div className="_margin_bottom_small">
                    <FilterExtract
                        activeSection={props.activeSection}
                    />
                    <WidgetManager
                        activeSection={props.activeSection}
                    />
                    {props.activeSection == "octaviMap" &&
                        <MapScaleManager
                            activeSection={props.activeSection}
                        />
                    }
                    <WidgetManagerSelector
                        activeSection={props.activeSection}
                    />
                    <MapWidgetManagerSelector
                        activeSection={props.activeSection}
                    />
                    <MapScaleManagerSelector
                        activeSection={props.activeSection}
                    />
                </div>
                {props.activeSection == "octaviHighlights" &&
                    <div className="_margin_bottom_small">
                        <ComparisonPanel
                            activeSection={props.activeSection}
                        />
                    </div>
                }
                <div className="_margin_bottom_small">
                    <div className="_bottom_border">
                        <h3 >{t('octavi:filters:calendar:sectionName')}</h3>
                    </div>
                    <CalendarPanel
                        activeSection={props.activeSection}
                    />
                </div>
                <div className="_margin_bottom_small">
                    <TemporalFilterPanel
                        activeSection={props.activeSection}
                    />
                </div>
                <div className="_margin_bottom_small">
                    <SpatialFilterPanel
                        activeSection={props.activeSection}
                    />
                    <SpatialFilterMap
                        activeSection={props.activeSection}
                    />
                </div>

                <div className="_margin_bottom_small">
                    <button
                        title={!needSubmit ? t('octavi:filters:submit:filterNeedChangeToAllowSubmit') : ''}
                        className={`filter_submit ${needSubmit ? 'glowingButton' : ''}`}
                        disabled={!needSubmit}
                        type="submit"
                        onClick={onSubmitForm}
                    >
                        {needSubmit ? t('octavi:filters:submit:applyNewFilters') : t('octavi:filters:submit:filterApplied')}
                    </button>
                </div>


            </div>
        </form>
    );
}

OctaviRightPanel.propTypes = {
    activeSection: PropTypes.string
}

export default OctaviRightPanel;
