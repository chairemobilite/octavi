import React from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from "prop-types"

import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import octaviParameters from '../../../services/ui/OctaviParameters';



class MapScaleManager extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
        dataSourceIds: octaviParameters.dataSourceIds
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
    serviceLocator.eventManager.emit('taxi.filter.mapScaleManager.request')
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
                {this.props.t('octavi:widgetOptions:scaleOptions:button')}
            </button>
        </div>
    );
  }
}


MapScaleManager.propTypes = {
    activeSection: PropTypes.string
  }

export default withTranslation()(MapScaleManager);
