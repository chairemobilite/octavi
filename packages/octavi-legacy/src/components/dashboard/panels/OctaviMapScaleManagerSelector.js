import React from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from "prop-types"

import AdvancedModal         from '../../AdvancedModal'
import { _isBlank }   from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import octaviParameters from '../../../services/ui/OctaviParameters';


class MapScaleManagerSelector extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      isActive      : false,
      selectedScale : serviceLocator.selectedScale && octaviParameters.get('selectedScale', null),
      scaleSplits   : serviceLocator.selectedScale && octaviParameters.get('mapScale', []),

    };

    this.selectedScaleChoices = [
        {value: "intervalBased"},
        {value: "distributionBased"},
        // TODO Support custom scale
        //{value: "custom"}
    ]


    this.handleOpen    = this.handleOpen.bind(this);
    this.handleClose   = this.handleClose.bind(this);
    this.handleConfirm = this.handleConfirm.bind(this);
    this.onScaleChange = this.onScaleChange.bind(this);
    this.isScaleValide = this.isScaleValide.bind(this);
    this.onScaleValueChange = this.onScaleValueChange.bind(this);


  }

  componentDidMount() {
    serviceLocator.eventManager.on("taxi.filter.mapScaleManager.request", this.handleOpen);

  }

  componentWillUnmount() {
    serviceLocator.eventManager.off("taxi.filter.mapScaleManager.request", this.handleOpen);
  }


  handleOpen() {
    this.setState({
      isActive      : true,
      scaleSplits   : serviceLocator.selectedScale && octaviParameters.get('mapScale', []),
    })
  }

  handleClose() {
    this.setState({
      isActive  : false,
    })
  }

  handleConfirm() {
    octaviParameters['selectedScale'] = this.state.selectedScale;
    serviceLocator.eventManager.emit('taxi.filter.selectedScale.update', {type: this.state.selectedScale, splits: this.state.scaleSplits});
  }

  onScaleChange(e) {
    this.setState({
        selectedScale : e.target.value
      })
  }

  onScaleValueChange(e, idx) {
    const newScale = [...this.state.scaleSplits]
    newScale[idx] = parseFloat(e.target.value)
    this.setState({
        scaleSplits : newScale
      })
  }

  isScaleValide() {
    return true;
    // TODO Support custom scales
    if (this.state.selectedScale === "custom") {
        return this.state.scaleSplits.length > 0 && this.state.scaleSplits.every((value,idx,splits) => !idx || splits[idx-1] <= value);
    } else {
        return true
    }
  }

  renderContainer() {
    return(
        <div>
            <div className="oct_widget_option_section">
                <div className="_two_column">
                    {this.props.t('octavi:widgetOptions:scaleOptions:title')}
                </div>
                <div className="_two_column">
                    <InputSelect
                        choices       = {this.selectedScaleChoices}
                        t             = {this.props.t}
                        value         = {this.state.selectedScale? this.state.selectedScale : "intervalBased"}
                        localePrefix  = "octavi:widgetOptions:scaleOptions"
                        onValueChange = {(e) => this.onScaleChange(e)}
                        noBlank       = {true}
                    />
                </div>
            </div>
            {/* TODO Support custom scales */ false &&
                this.state.selectedScale && this.state.selectedScale === "custom" && <div>
                <div>
                    {this.props.t('octavi:widgetOptions:customScaleOptions:title')}
                </div>
                {!this.isScaleValide() && <div className='_error'>
                    {this.props.t('octavi:widgetOptions:customScaleOptions:error')}
                </div>}
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:minValue')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value         = {this.state.scaleSplits[0]}
                            type          = {'number'}
                            disabled      = {true}
                        />
                    </div>
                </div>
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:break_1')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value           = {this.state.scaleSplits[1]}
                            type            = {'number'}
                            onValueChange  = {(e) => this.onScaleValueChange(e,1)}
                        />
                    </div>
                </div>
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:break_2')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value           = {this.state.scaleSplits[2]}
                            type            = {'number'}
                            onValueChange  = {(e) => this.onScaleValueChange(e,2)}
                        />
                    </div>
                </div>
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:break_3')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value           = {this.state.scaleSplits[3]}
                            type            = {'number'}
                            onValueChange  = {(e) => this.onScaleValueChange(e,3)}
                        />
                    </div>
                </div>
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:break_4')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value           = {this.state.scaleSplits[4]}
                            type            = {'number'}
                            onValueChange  = {(e) => this.onScaleValueChange(e,4)}
                        />
                    </div>
                </div>
                <div className="oct_widget_option_section">
                    <div className="_two_third_column right">
                        {this.props.t('octavi:widgetOptions:customScaleOptions:maxValue')}
                    </div>
                    <div className="_three_columns">
                        <InputString
                            value         = {this.state.scaleSplits[5]}
                            type          = {'number'}
                            disabled      = {true}
                        />
                    </div>
                </div>
            </div>}

        </div>
    )
  }

  render() {
    const { isActive, selected } = this.state

    return (
      <AdvancedModal
        title                   = {this.props.t('octavi:widgetOptions:scaleOptions:popupTitle')}
        t                       = {this.props.t}
        isOpen                  = {isActive}
        container               = {this.renderContainer()}
        showCancelButton        = {true}
        showConfirmButton       = {true}
        closeModal              = {this.handleClose}
        confirmAction           = {this.handleConfirm}
        isConfirmButtonDisabled = {!this.isScaleValide()}
      />
    )
  }
}

export default withTranslation()(MapScaleManagerSelector);


MapScaleManagerSelector.propTypes = {
    activeSection: PropTypes.string
  }
