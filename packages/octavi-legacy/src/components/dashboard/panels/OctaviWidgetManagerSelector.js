import React from 'react';
import PropTypes from "prop-types";
import { withTranslation } from 'react-i18next';

import AdvancedModal         from '../../AdvancedModal'
import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// Converts seconds to minutes
// TODO Allow to change that divider and update unit string (#2079)
const defaultDurationDivider = 60

class WidgetManagerSelector extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      isActive : false,
    };

    this.handleOpen    = this.handleOpen.bind(this);
    this.handleClose   = this.handleClose.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);

  }

  componentDidMount() {
    serviceLocator.eventManager.on("taxi.filter.manageWidgets.request", this.handleOpen);

  }

  componentWillUnmount() {
    serviceLocator.eventManager.off("taxi.filter.manageWidgets.request", this.handleOpen);
  }


  handleOpen() {
    this.setState({
      isActive : true,
    })
  }

  handleClose() {
    this.setState({
      isActive : false,
    })
  }

  onButtonClick(widgetInfo, widgetOptions) {
    serviceLocator.eventManager.emit('taxi.filter.selectedWidgets.add', widgetInfo, widgetOptions)
    this.setState({
        isActive : false,
    })
  }




  renderContainer() {
    return(
        <div>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"trips", labelName:"trips", type:"discrete", allowStatus:false}, {statusOption:"occupied"})}
            >
                {this.props.t('octavi:filters:widgets:labelTrips')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"activities", labelName:"activities", type:"discrete"})}
            >
                {this.props.t('octavi:filters:widgets:labelActivities')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"vehicles", labelName:"vehicles", type:"discrete"})}
            >
                {this.props.t('octavi:filters:widgets:labelVehicles')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"driver", labelName:"driver", type:"discrete"})}
            >
                {this.props.t('octavi:filters:widgets:labelDrivers')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"operators", labelName:"operators", type:"discrete"})}
            >

                {this.props.t('octavi:filters:widgets:labelOperators')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"distance", labelName:"distance", type:"continuous", divider:1000})}
            >

                {this.props.t('octavi:filters:widgets:labelDistance')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"distance", labelName:"distance", type:"continuous", divider:1000, allowStatus:false}, {statusOption:"occupied"})}
            >

                {this.props.t('octavi:filters:widgets:labelDistanceTrip')}
            </button>
            <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"duration", labelName:"duration", type:"continuous", divider: defaultDurationDivider})}
            >

                {this.props.t('octavi:filters:widgets:labelDuration')}
            </button>
                <button
                className = "_two_third_column _input _input-select-button _bottom_padding"
                style     = {{display: "inline-block"}}
                type      = "button"
                onClick   = {() => this.onButtonClick({object:"duration", labelName:"duration", type:"continuous", divider: defaultDurationDivider, allowStatus:false}, {statusOption:"occupied"})}
            >

                {this.props.t('octavi:filters:widgets:labelDurationTrip')}
            </button>
        </div>
    )
  }


  render() {
    const { isActive, selectedWidgets } = this.state

    return (
      <AdvancedModal
        title                   = {this.props.t('octavi:filters:widgets:popupTitle')}
        t                       = {this.props.t}
        isOpen                  = {isActive}
        container               = {this.renderContainer()}
        showCancelButton        = {true}
        showConfirmButton       = {false}
        closeModal              = {this.handleClose}
        isConfirmButtonDisabled = {false}
      />
    )
  }
}

WidgetManagerSelector.propTypes = {
    t            : PropTypes.func,
    i18n         : PropTypes.object,
    activeSection: PropTypes.string
  }

export default withTranslation()(WidgetManagerSelector);
