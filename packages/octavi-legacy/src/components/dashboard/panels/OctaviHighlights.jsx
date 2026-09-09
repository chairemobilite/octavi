import React from 'react';
import { withTranslation } from 'react-i18next';
import { v4 as uuidV4 } from 'uuid';

import TotalCountWidget                   from '../widgets/TotalCount.widget';
import { _isBlank }                       from 'chaire-lib-common/lib/utils/LodashExtensions';
import octaviParameters from '../../../services/ui/OctaviParameters';
import serviceLocator                     from 'chaire-lib-common/lib/utils/ServiceLocator';

class OctaviHighlights extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      startAt           : null,
      endAt             : null,
      selectedWidgets   : octaviParameters.selectedWidgets
    };

    this.onWidgetAdd            = this.onWidgetAdd.bind(this);
    this.onWidgetDelete         = this.onWidgetDelete.bind(this);
    this.updateWidgetSelection  = this.updateWidgetSelection.bind(this);
  }

  componentDidMount() {
    serviceLocator.eventManager.on('taxi.filter.selectedWidgets.add', this.onWidgetAdd);
    serviceLocator.eventManager.on('taxi.filter.selectedWidgets.delete', this.onWidgetDelete);
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.filter.selectedWidgets.add', this.onWidgetAdd);
    serviceLocator.eventManager.off('taxi.filter.selectedWidgets.delete', this.onWidgetDelete);
  }


  onWidgetAdd(widgetInfo, widgetOptions) {
    let newSelectedWidgets
    if (this.state.selectedWidgets === undefined) {
        newSelectedWidgets = {}
    } else {
        newSelectedWidgets = {...this.state.selectedWidgets}
    }
    const newUuid = uuidV4();
    newSelectedWidgets[newUuid] = {
        ...widgetInfo,
        options: widgetOptions ? widgetOptions : {},
        uuid: newUuid,
    }

    this.setState({
        selectedWidgets: newSelectedWidgets
    })
    octaviParameters.selectedWidgets = newSelectedWidgets;
    serviceLocator.eventManager.emit(`taxi.widget.${newUuid}SelectOptions.update`)
    this.updateWidgetSelection()
  }

  onWidgetDelete(uuid) {
    let newSelectedWidgets = {...this.state.selectedWidgets}
    delete newSelectedWidgets[uuid]
    this.setState({
        selectedWidgets: newSelectedWidgets
    })
    octaviParameters.selectedWidgets = newSelectedWidgets;
    this.updateWidgetSelection()
  }

  updateWidgetSelection() {
      let newSelectedWidgets = octaviParameters.selectedWidgets;

      this.setState({
          selectedWidgets: newSelectedWidgets
      })
  }


  getSelectedWidgetComponents(selectedWidgets) {
    const widgets = [];
    for (let widgetUuid in selectedWidgets) {
      const widgetSpecs = selectedWidgets[widgetUuid]
      widgets.push(
        <TotalCountWidget
            key                 = {`widget_${widgetSpecs.uuid}`}
            uuid                = {widgetSpecs.uuid}
            t                   = {this.props.t}
            i18n                = {this.props.i18n}
            object              = {widgetSpecs.object}
            customFilterString  = {null}
            type                = {widgetSpecs.type}
            labelName           = {widgetSpecs.labelName}
            countPerHour        = {true}
            countPerWeekday     = {true}
            widgetSpecs         = {widgetSpecs}
        />
      )
    }

    return widgets;
}

  render() {
    return (
      <div className="tr__widgets__container">
        {Object.keys(this.state.selectedWidgets).length !== 0 && this.getSelectedWidgetComponents(this.state.selectedWidgets)}
        {Object.keys(this.state.selectedWidgets).length === 0 && <div className="tr__widget__container">
            <div className={"widget_title_width"}>
                <h3>
                    {this.props.t('octavi:widgets:noWidget')}
                </h3>
            </div>
        </div>}
    </div>
    );
  }

}

export default withTranslation()(OctaviHighlights);
