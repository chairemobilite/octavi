import moment from 'moment';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const setAndSavePreference = (path, value) => {
    // First set to make sure the value will be set during update
    Preferences.set(path, value);
    // Then save preferences
    Preferences.save(serviceLocator.socketEventManager, serviceLocator.eventManager, {[path]: value});
}

// Initialize a filter for yesterday by default
const getDefaultFilter = (filterName) => {
    // init filters
    const yesterday =  Date.now() - 24 * 3600 * 1000

    return {
        name: filterName,
        //calender
        'calendarStartAt': moment(yesterday).format("YYYY-MM-DD"), //default date is set to yesterday
        'calendarEndAt': moment(yesterday).format("YYYY-MM-DD"), //default date is set to yesterday
        //temporal
        'temporalFilterIsSelected': false, // boolean
        'hourIsSelected': false, // boolean
        'hourChoices': null, // array of string in format '<start>_<end>' ou 'other'
        'hourCustomChoices': null, // array of string in format '<start>_<end>'
        'dayIsSelected': false, // boolean
        'dayChoices': null, // array of 'monday', 'tuesday', etc
        //spatial
        'spatialFilterIsSelected': false, // boolean
        'originIsSelected': false, // boolean
        'selectedOriginDistricts': null, // array of zone uuids
        'destinationIsSelected': false, // boolean
        'selectedDestinationDistricts': null // array of zones uuids
    }
}

/**
 * Octavi parameters class. It just wraps the `octavi` preferences calls, with
 * some direct getters.
 *
 * TODO When we refactor octavi parameters and filter, this class can be updated to
 * centralize the filtering parameters.
 */
class OctaviParameters {

    get dataSourceIds() {
        const response = Preferences.get(`octavi.dataSourceIds`);
        if (response === undefined || response.length === 0) {
            const defaultDataSourceShortname = Preferences.get('defaultTaxiDataSourceShortname');
            const dsCollection = serviceLocator.collectionManager.get('dataSources');
            if (dsCollection === undefined) {
                // Not loaded yet
                return [];
            }
            const defaultDataSource = dsCollection.getByShortname(defaultDataSourceShortname);
            const dataSourceIds = defaultDataSource !== undefined? [defaultDataSource.getId()] : [];
            setAndSavePreference(`octavi.dataSourceIds`, dataSourceIds);
            return dataSourceIds;
        }
        return response;
    }

    get selectedWidgets() {
        return Preferences.get(`octavi.selectedWidgets`, {})
    }

    set selectedWidgets(widgets) {
        setAndSavePreference('octavi.selectedWidgets', widgets);
    }

    get mapOptions() {
        return Preferences.get('octavi.mapOptions', {
            selectedMapWidget: "originMap",
            selectedMapStyle:"SMMap",
            selectedMapObject:"activities"
        });
    }

    set mapOptions(mapOptions) {
        setAndSavePreference('octavi.mapOptions', mapOptions);
    }

    get selectedMapWidget() {
        return Preferences.get('octavi.selectedMapWidget', '');
    }

    set selectedMapWidget(mapWidget) {
        setAndSavePreference('octavi.selectedMapWidget', mapWidget);
    }

    get filterSelected() {
        return Preferences.get('octavi.filterSelected', '');
    }

    // TODO When refactoring filters, this should be the index of the filter
    set filterSelected(filterName) {
        setAndSavePreference('octavi.filterSelected', filterName);
    }

    get filters() {
        return Preferences.get('octavi.filters', [getDefaultFilter('FilterOne'), getDefaultFilter('FilterTwo')]);
    }

    set filters(filters) {
        setAndSavePreference('octavi.filters', filters);
    }

    get comparisonIsSelected() {
        return Preferences.get('octavi.comparisonIsSelected', false);
    }

    // TODO When refactoring filters, this should be the index of the filter
    set comparisonIsSelected(selected) {
        setAndSavePreference('octavi.comparisonIsSelected', selected);
    }

    get(path, defaultValue = undefined) {
        return Preferences.get(`octavi.${path}`, defaultValue);
    }

    set(path, value) {
        setAndSavePreference(`octavi.${path}`, value);
    }

}



const octaviParameters = new OctaviParameters();
// FIXME This proxy handler is required for [] getters and setters
const handler = {
    get: function(target, name) {
        if (name === 'get') {
            return target.get;
        } else if (name === 'set') {
            return target.set;
        } else if (target[name] !== undefined) {
            return target[name];
        }
        return target.get(name);
    },
    set: function (target, name, value) {
        if (target[name] !== undefined) {
            target[name] = value;
        } else {
            target.set(name, value);
        }
        return true;
    }
};
const proxy = new Proxy(octaviParameters, handler);
export default proxy;
