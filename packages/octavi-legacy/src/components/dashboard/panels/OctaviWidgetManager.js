import React from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from "prop-types"

import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import octaviParameters from '../../../services/ui/OctaviParameters';



class WidgetManager extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
        dataSourceIds  : octaviParameters.dataSourceIds
    };

    this.onButtonClick       = this.onButtonClick.bind(this);
    this.updateDataSourceIds = this.updateDataSourceIds.bind(this);
  }

  componentDidMount() {
    serviceLocator.eventManager.on('taxi.dataSources.loaded', this.updateDataSourceIds);
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.dataSources.loaded', this.updateDataSourceIds);
  }


  updateDataSourceIds() {
    this.setState({
      dataSourceIds: octaviParameters.dataSourceIds
    });
  }

  onButtonClick(){
    if (this.props.activeSection == "octaviHighlights") {
        serviceLocator.eventManager.emit('taxi.filter.manageWidgets.request')

    }
    if (this.props.activeSection == "octaviMap") {
        serviceLocator.eventManager.emit('taxi.filter.manageMapWidget.request')
    }
  }

  render() {

    if (this.state.dataSourceIds.length === 0)
    {
      return <LoadingPage />;
    }
    return (
        <div className="tr__form-input-container">
            <button
                className = {"button grey"}
                type      = "button"
                onClick   = {x => this.onButtonClick()}
            >
                {this.props.activeSection == "octaviMap" ? this.props.t('octavi:filters:mapWidget:sectionName') : this.props.t('octavi:filters:widgets:sectionName')}
            </button>
        </div>
    );
  }
}

export default withTranslation()(WidgetManager);

WidgetManager.propTypes = {
    activeSection: PropTypes.string
}
