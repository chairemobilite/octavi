import React from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from "prop-types"

import AdvancedModal         from '../../AdvancedModal'
import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import octaviParameters from '../../../services/ui/OctaviParameters';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';



class MapWidgetManagerSelector extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      isActive     : false,
      mapOptions   : octaviParameters.mapOptions
    };

    this.handleOpen    = this.handleOpen.bind(this);
    this.handleClose   = this.handleClose.bind(this);
    this.handleConfirm = this.handleConfirm.bind(this);
    this.onValueChange = this.onValueChange.bind(this);

    this.selectedMapWidgetChoices = [
        {value: "originMap"},
        {value: "destinationMap"}
    ]

    this.selectedMapStyleChoices = [
        {value: "SRMap"},
        {value: "SMMap"}
    ]

    this.selectedObjectChoices = [
        {value: "driver"},
        {value: "vehicles"},
        {value: "operators"},
        {value: "activities"},
        {value: "distance"},
        {value: "duration"},
    ]

    this.temporalOptionChoices = [
        {value: "byMonth"},
        {value: "byWeek"},
        {value: "byDay"},
        {value: "none"}
    ]

  }

  componentDidMount() {
    serviceLocator.eventManager.on("taxi.filter.manageMapWidget.request", this.handleOpen);

  }

  componentWillUnmount() {
    serviceLocator.eventManager.off("taxi.filter.manageMapWidget.request", this.handleOpen);
  }


  handleOpen() {
    this.setState({
      isActive  : true,
      selected : {}
    })
  }

  handleClose() {
    this.setState({
      isActive  : false,
      selected : {}
    })
  }

  handleConfirm() {
    octaviParameters.mapOptions = this.state.mapOptions;
    serviceLocator.eventManager.emit('taxi.filter.selectedMapOptions.update', this.state.mapOptions);
  }

  onValueChange(e, optionName) {
    const newSelectedOption = e.target.value
    const newOptions = {...this.state.mapOptions}
    newOptions[optionName] = newSelectedOption
    this.setState({mapOptions:newOptions})
  }

  renderContainer() {
    const objectChoisesList = ["operators", "driver", "vehicles", "activities", "none"];
    if (objectChoisesList.includes(this.state.mapOptions.selectedMapObject)) {
        objectChoisesList.splice(objectChoisesList.indexOf(this.state.mapOptions.selectedMapObject), 1);
    }
    const objecChoises = objectChoisesList.map(function(choice){return{value:choice}});
    return(
        <div>

        <div className="oct_widget_option_section">
            <div className="_two_column">
                {this.props.t('octavi:widgetOptions:mapObject:title')}
            </div>
            <div className="_two_column">
                <InputSelect
                    choices       = {this.selectedObjectChoices}
                    t             = {this.props.t}
                    value         = {this.state.mapOptions.selectedMapObject? this.state.mapOptions.selectedMapObject : "none"}
                    localePrefix  = "octavi:widgetOptions:mapObject"
                    onValueChange = {(e) => this.onValueChange(e, "selectedMapObject")}
                    noBlank       = {true}
                />
            </div>
        </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">
                    {this.props.t('octavi:widgetOptions:tripPart:title')}
                </div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.selectedMapWidgetChoices}
                        t             = {this.props.t}
                        value         = {this.state.mapOptions.selectedMapWidget? this.state.mapOptions.selectedMapWidget : "none"}
                        localePrefix  = "octavi:widgetOptions:tripPart"
                        onValueChange = {(e) => this.onValueChange(e, "selectedMapWidget")}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">
                    {this.props.t('octavi:widgetOptions:mapStyle:title')}
                </div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.selectedMapStyleChoices}
                        t             = {this.props.t}
                        value         = {this.state.mapOptions.selectedMapStyle? this.state.mapOptions.selectedMapStyle : "none"}
                        localePrefix  = "octavi:widgetOptions:mapStyle"
                        onValueChange = {(e) => this.onValueChange(e, "selectedMapStyle")}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">
                    {this.props.t('octavi:widgetOptions:temporalOption:title')}
                </div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.temporalOptionChoices}
                        t             = {this.props.t}
                        value         = {this.state.mapOptions.temporalOption? this.state.mapOptions.temporalOption : "none"}
                        localePrefix  = "octavi:widgetOptions:temporalOption"
                        onValueChange = {(e) => this.onValueChange(e, "temporalOption")}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">
                    {this.props.t('octavi:widgetOptions:objectOption:title')}
                </div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {objecChoises}
                        t             = {this.props.t}
                        value         = {this.state.mapOptions.objectOption? this.state.mapOptions.objectOption : "none"}
                        localePrefix  = "octavi:widgetOptions:objectOption"
                        onValueChange = {(e) => this.onValueChange(e, "objectOption")}
                        noBlank       = {true}
                    />
                </div>
            </div>

        </div>
    )
  }

  render() {
    const { isActive, selected } = this.state

    return (
      <AdvancedModal
        title                   = {this.props.t('octavi:widgetOptions:mapTitle')}
        t                       = {this.props.t}
        isOpen                  = {isActive}
        container               = {this.renderContainer()}
        showCancelButton        = {true}
        showConfirmButton       = {true}
        closeModal              = {this.handleClose}
        confirmAction           = {this.handleConfirm}
        isConfirmButtonDisabled = {false}
      />
    )
  }
}

export default withTranslation()(MapWidgetManagerSelector);

MapWidgetManagerSelector.propTypes = {
    activeSection: PropTypes.string
  }
