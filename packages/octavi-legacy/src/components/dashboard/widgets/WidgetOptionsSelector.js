import React from 'react';
import PropTypes from "prop-types"

import AdvancedModal         from '../../AdvancedModal'
import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import octaviParameters from '../../../services/ui/OctaviParameters'

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';



export default class widgetTemporalOptionSelector extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      isActive        : false,
      selectedOptions : octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {}),
    };

    this.handleOpen    = this.handleOpen.bind(this);
    this.handleClose   = this.handleClose.bind(this);
    this.handleConfirm = this.handleConfirm.bind(this);
    this.onValueTemporalChange         = this.onValueTemporalChange.bind(this);
    this.onValueGeographicalChange     = this.onValueGeographicalChange.bind(this)
    this.onValueOnLocationOptionChange = this.onValueOnLocationOptionChange.bind(this)
    this.onValueObjectChange           = this.onValueObjectChange.bind(this);
    this.onValueGraphChange            = this.onValueGraphChange.bind(this);
    this.onValueStatusChange           = this.onValueStatusChange.bind(this);

    this.temporalOptionChoices = [
        {value: "byMonth"},
        {value: "byWeek"},
        {value: "byDay"},
        {value: "none"}
    ]

    this.geographicalOptionChoices = [
        {value: "bySR"},
        {value: "bySM"},
        {value: "none"}
    ]

    this.statusOptionChoices = [
        {value: "unavailable"},
        {value: "oncoming"},
        {value: "occupied"},
        {value: "free"},
        {value: "none"}
    ]

  }

  componentDidMount() {
    serviceLocator.eventManager.on(`taxi.widget.${this.props.uuid}ManageOptions.request`, this.handleOpen);

  }

  componentWillUnmount() {
    serviceLocator.eventManager.off(`taxi.widget.${this.props.uuid}ManageOptions.request`, this.handleOpen);
  }


  handleOpen() {
    this.setState({
      isActive        : true,
      selectedOptions : octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {}),
    })
  }

  handleClose() {
    this.setState({
      isActive               : false,
    })
  }

  onValueTemporalChange(e) {
    this.setState({
        selectedOptions : {
            ...this.state.selectedOptions,
            temporalOption: e.target.value
        }
    })
  }

  onValueGeographicalChange(e) {
    const actualSelectedOptions = this.state.selectedOptions
    if (e.target.value === "none" && this.state.selectedOptions.onLocationOption) {
        delete actualSelectedOptions['onLocationOption']
    }
    if (e.target.value !== "none") {
        actualSelectedOptions['onLocationOption'] =  actualSelectedOptions.onLocationOption ? actualSelectedOptions.onLocationOption : "origin"
    }

    this.setState({
        selectedOptions : {
            ...actualSelectedOptions,
            geographicalOption: e.target.value,
            graphOption: (e.target.value === "none" && this.state.selectedOptions.graphOption === "spatialDistribution") ? "temporalMean" : this.state.selectedOptions.graphOption
        }
    })
  }

  onValueOnLocationOptionChange(e) {
      this.setState({
          selectedOptions : {
              ...this.state.selectedOptions,
              onLocationOption: e.target.value
          }
      })
  }


  onValueObjectChange(e) {
    this.setState({
        selectedOptions : {
            ...this.state.selectedOptions,
            objectOption: e.target.value,
            graphOption: (e.target.value === "none" && this.state.selectedOptions.graphOption === "objectDistribution") ? "temporalMean" : this.state.selectedOptions.graphOption
        }
    })
  }

  onValueGraphChange(e) {
    this.setState({
        selectedOptions : {
            ...this.state.selectedOptions,
            graphOption: e.target.value
        }
    })
  }

  onValueStatusChange(e) {
    this.setState({
        selectedOptions : {
            ...this.state.selectedOptions,
            statusOption: e.target.value
        }
    })
  }

  handleConfirm() {
    octaviParameters[`selectedWidgets.${this.props.uuid}.options`] = this.state.selectedOptions;
    serviceLocator.eventManager.emit(`taxi.widget.${this.props.uuid}SelectOptions.update`);
  }

  handleLoad() {
    }

  renderContainer() {
    const objectChoisesList = ["operators", "driver", "vehicles", "activities", "none"];
    if (objectChoisesList.includes(this.props.object)) {
        objectChoisesList.splice(objectChoisesList.indexOf(this.props.object), 1);
    }
    const objecChoises = objectChoisesList.map(function(choice){return{value:choice}});
    const graphOptionChoices = [{value: "temporalMean"}]
    if (this.state.selectedOptions.objectOption && this.state.selectedOptions.objectOption !== "none") {
        graphOptionChoices.push({value: "objectDistribution"})
    }
    if (this.state.selectedOptions.geographicalOption && this.state.selectedOptions.geographicalOption !== "none") {
        graphOptionChoices.push({value: "spatialDistribution"})
    }

    return(
        <div>

            <div className="oct_widget_option_section">
                <div className="_two_column">{this.props.t('octavi:widgetOptions:temporalOption:title')}</div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.temporalOptionChoices}
                        t             = {this.props.t}
                        value         = {this.state.selectedOptions.temporalOption? this.state.selectedOptions.temporalOption : "none"}
                        localePrefix  = "octavi:widgetOptions:temporalOption"
                        onValueChange = {(e) => this.onValueTemporalChange(e)}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">{this.props.t('octavi:widgetOptions:objectOption:title')}</div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {objecChoises}
                        t             = {this.props.t}
                        value         = {this.state.selectedOptions.objectOption? this.state.selectedOptions.objectOption : "none"}
                        localePrefix  = "octavi:widgetOptions:objectOption"
                        onValueChange = {(e) => this.onValueObjectChange(e)}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">{this.props.t('octavi:widgetOptions:geographicalOption:title')}</div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.geographicalOptionChoices}
                        t             = {this.props.t}
                        value         = {this.state.selectedOptions.geographicalOption? this.state.selectedOptions.geographicalOption : "none"}
                        localePrefix  = "octavi:widgetOptions:geographicalOption"
                        onValueChange = {(e) => this.onValueGeographicalChange(e)}
                        noBlank       = {true}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">{this.props.t('octavi:widgetOptions:onLocationOption:title')}</div>
                <div className="_two_column">
                    <InputSelect
                        choices       =  {[{value: "origin"},{value: "destination"}]}
                        t             = {this.props.t}
                        value         = {this.state.selectedOptions.onLocationOption ? this.state.selectedOptions.onLocationOption : "onOrigin"}
                        localePrefix  = "octavi:widgetOptions:onLocationOption"
                        onValueChange = {(e) => this.onValueOnLocationOptionChange(e)}
                        noBlank       = {true}
                        disabled      = {!(this.state.selectedOptions.geographicalOption && this.state.selectedOptions.geographicalOption !== "none")}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
                <div className="_two_column">{this.props.t('octavi:widgetOptions:graphOption:title')}</div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {graphOptionChoices}
                        t             = {this.props.t}
                        value         = {this.state.selectedOptions.graphOption? this.state.selectedOptions.graphOption : "temporalMean"}
                        localePrefix  = "octavi:widgetOptions:graphOption"
                        onValueChange = {(e) => this.onValueGraphChange(e)}
                        noBlank       = {true}
                        disabled      = {!((this.state.selectedOptions.objectOption && this.state.selectedOptions.objectOption !== "none") || (this.state.selectedOptions.geographicalOption && this.state.selectedOptions.geographicalOption !== "none"))}
                    />
                </div>
            </div>

            <div className="oct_widget_option_section">
            <div className="_two_column">{this.props.t('octavi:widgetOptions:statusOption:title')}</div>
            <div className="_two_column">
                <InputSelect
                    choices       = {this.statusOptionChoices}
                    t             = {this.props.t}
                    value         = {this.state.selectedOptions.statusOption? this.state.selectedOptions.statusOption : "none"}
                    localePrefix  = "octavi:widgetOptions:statusOption"
                    onValueChange = {(e) => this.onValueStatusChange(e)}
                    noBlank       = {true}
                    disabled      = {!this.props.allowStatus}
                />
            </div>
        </div>

        </div>
    )
  }


  render() {
    const { isActive } = this.state

    return (
      <AdvancedModal
        title                   = {`${this.props.t('octavi:widgetOptions:title')}${this.props.t(`octavi:widgets.${this.props.labelName}.name`)}`}
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


widgetTemporalOptionSelector.propTypes = {
    t            : PropTypes.func,
    i18n         : PropTypes.object,
    activeSection: PropTypes.string,
    object       : PropTypes.string,
    labelName    : PropTypes.string
  }
