import React            from "react";
import PropTypes        from "prop-types"
import Highcharts       from "highcharts";
import ReactHighcharts  from "highcharts-react-official";
import More             from "highcharts/highcharts-more"
import Exporting        from "highcharts/modules/exporting";
import ExportData       from "highcharts/modules/export-data";
import Heatmap          from "highcharts/modules/heatmap";
import Boost            from "highcharts/modules/boost"
import BoostCanvas      from "highcharts/modules/boost-canvas"

import Preferences             from 'chaire-lib-common/lib/config/Preferences';
import {generateGraphOptions}  from "./optionsGenerator"
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import Theme                   from "./chartDefaultStyle";

More(Highcharts)
Exporting(Highcharts);
ExportData(Highcharts);
Heatmap(Highcharts);
Boost(Highcharts)
BoostCanvas(Highcharts)
Theme(Highcharts);


export default class Chart extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoaded: false,
      isEmpty : false,
      isError: false,
      options : {},
    };
  }

  componentDidMount() {
    const asyncOptions = generateGraphOptions(this.props)
    asyncOptions.then(({error, ...options}) => {
      if (Object.keys(options).length === 0) {
        this.setState({
          isLoaded: true,
          isEmpty: true,
          isError: error,
          options: {}
        })
      }
      else {
        this.setState({
          isLoaded: true,
          isEmpty: false,
          options: options,
          isError: error
        })
      }
    })
  }

  render() {
    const { size, id, t } = this.props
    const { isLoaded, isEmpty, options, isError } = this.state

    if (isEmpty || isError || Object.keys(options).length === 0) {
      return <h3 style={{margin:'auto'}}>{isError ? t('osc2ar:chartDataError') : t('osc2ar:noData')}</h3>
    }

    if (!isLoaded) {
      return (
        <LoadingPage
          message={t('osc2ar:GraphLoading')}
        />
      );
    }

    if (size == "small") {
      if (options.title.style) {options.title.style["fontSize"] = "16px"}
      if (options.legend) {options.legend["enabled"] = false}
      options.credits = "";
    }


    process.env.APP_NAME == 'octavi' ? Highcharts.setOptions({ lang: Preferences.get('highcharts.lang.' + this.props.i18n.language) }) : ""

    return (
      <ReactHighcharts
        options        = {options}
        highcharts     = {Highcharts}
        containerProps = {{ style: { height: "100%", width: "100%" } }}
        key            = {id}
      >
      </ReactHighcharts>
    )
  }

}

Chart.propTypes = {
  t              : PropTypes.func,
  size           : PropTypes.string,
  id             : PropTypes.string,
}
