import Highcharts       from 'highcharts';
import { max, min, sortBy, sumBy } from 'lodash'

const getDistribution = function(values) {
    const sortedValues = sortBy(values);
    const maxNbOfValue = 50;

    const frequencyCounts = [{
        value  : sortedValues[0],
        count  : 0
    }]
    for (const i in sortedValues) {
        if (frequencyCounts[frequencyCounts.length -1].value === sortedValues[i]) {
            frequencyCounts[frequencyCounts.length -1] = {
                value  : sortedValues[i],
                count  : frequencyCounts[frequencyCounts.length -1].count + 1
            }
        } else {
            frequencyCounts.push({
                value  : sortedValues[i],
                count  : 1
            })
        }
    }
    let distribution;
    if (frequencyCounts.length > maxNbOfValue) {
        const minValue = Math.floor(min(frequencyCounts.map(value => value.value)));
        const maxValue = Math.ceil(max(frequencyCounts.map(value => value.value))) + 1;
        const step = ((maxValue - minValue) / maxNbOfValue) >> 0;
        const remainder = (maxValue - minValue) % maxNbOfValue;
        distribution = [];

        for (let i = 0; i < maxNbOfValue; i++) {
            const start = minValue + step * i + min([i, remainder]);
            const end = minValue + step * (i+1) + min([i+1, remainder]);
            const count = sumBy(frequencyCounts.filter(value => (value.value >= start) && (value.value < end)), value => value.count);

            distribution.push({
                label: start + " - " + end,
                x:(start + end)/2,
                y:count
            });
        }

    } else {
        distribution = frequencyCounts.map(value => {return {
            label:value.value,
            x:value.value,
            y:value.count
        }})

    }
    return distribution
}


export default function(data, filter, t, fileName) {

    let maxYAxis;
    let minXAxis;
    let maxXAxis;
    let error = false;

    let yAxisTitle
    if (filter.options.graphOption === "objectDistribution") {
        yAxisTitle = t("octavi:charts:numberOf") + " " + t(`octavi:widgets:${filter.options.objectOption}:object`)
        yAxisTitle = yAxisTitle.charAt(0).toUpperCase() + yAxisTitle.slice(1)
    } else if (filter.options.graphOption === "spatialDistribution") {
        yAxisTitle = t("octavi:charts:" + filter.options.geographicalOption)
        yAxisTitle = yAxisTitle.charAt(0).toUpperCase() + yAxisTitle.slice(1)
    }

    let xAxisTitle
    xAxisTitle = t(`octavi:widgets:${filter.object}:object`)
    xAxisTitle = xAxisTitle.charAt(0).toUpperCase() + xAxisTitle.slice(1)

    const tooltip = function(xAxisTitle, yAxisTitle) {
        return {
            headerFormat: `<b>{series.name}</b><br>`,
            pointFormat:  `<b>${xAxisTitle}: {point.label}</b><br><b>${yAxisTitle} : {point.y}</b>`
        };
      }

    if (data.valueFilterOne.status === 'error') {
        error = true;
    }

    //first serie variables
    const valuesFilterOne = Object.values(data.valueFilterOne.counts);
    const densityFilterOne = getDistribution(valuesFilterOne)
    const maxYValueFilterOne = max(densityFilterOne.map(point => point.y));
    const maxYAxisFilterOne = Math.ceil(maxYValueFilterOne/10)*10

    const minXValueFilterOne = min(densityFilterOne.map(point => point.x));
    const maxXValueFilterOne = max(densityFilterOne.map(point => point.x));

    const series = {first:densityFilterOne}

    //secon serie variables

    if (data.valueFilterTwo) {
        if (data.valueFilterTwo.status === 'error') {
            error = true;
        }
        const valuesFilterTwo = Object.values(data.valueFilterTwo.counts);
        const densityFilterTwo = getDistribution(valuesFilterTwo)
        const maxYValueFilterTwo = max(densityFilterTwo.map(point => point.y));
        const maxYAxisFilterTwo = Math.ceil(maxYValueFilterTwo/10)*10

        const minXValueFilterTwo = min(densityFilterTwo.map(point => point.x));
        const maxXValueFilterTwo = max(densityFilterTwo.map(point => point.x));

        series.second = densityFilterTwo;

        //global varaibles
        maxYAxis = max([maxYAxisFilterOne, maxYAxisFilterTwo])

        minXAxis = min([minXValueFilterOne, minXValueFilterTwo]);
        maxXAxis = max([maxXValueFilterOne, maxXValueFilterTwo]);

    } else {
        //global varaibles
        maxYAxis = maxYAxisFilterOne;

        minXAxis = minXValueFilterOne;
        maxXAxis = maxXValueFilterOne;
    }

  //series construction
  const highchartSeries = [
    {
      name: data.valueFilterTwo? `${yAxisTitle} : Première période` : yAxisTitle,
      yAxis: 0,
      data: series['first'],
      color: Highcharts.getOptions().colors[0],
      opacity: 0.6,
      pointPadding:0,
      groupPadding: 0,
      borderWidth: 0,
      states : {
        hover: {
          opacity: 1
        }
      }
    }]

    if (data.valueFilterTwo) {
        highchartSeries.push(
            {
                name: data.valueFilterTwo? `${yAxisTitle} Seconde période` : yAxisTitle,
                yAxis: 0,
                data: series['second'],
                color: Highcharts.getOptions().colors[3],
                opacity: 0.6,
                pointPadding:0,
                groupPadding: 0,
                borderWidth: 0,
                states : {
                    hover: {
                    opacity: 1
                    }
                }
            }
        )
    }

  return {

    chart: {
      zoomType: "xy",
      type: "column",
      height: (9 / 16 * 100) + '%' // 16:9 ratio
    },


    title: {
      text: null,
      style: {
        fontSize: "18px",
        overflow:'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
      }
    },

    subtitle: {
      text: null,
      style: {
        overflow:'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
      }
    },

    legend: {
      enabled: false,
      layout: "vertical",
      align: "right",
      verticalAlign: "top",
      x: 0,
      y: 0,
    },

    yAxis: [
      {
        title: {
          text: yAxisTitle,
          style: {
            color: Highcharts.getOptions().colors[1]
          }
        },
        labels: {
          format: "{value}",
          style: {
            color: Highcharts.getOptions().colors[1]
          }
        },
        min: 0,
        max: maxYAxis,
        tickinterval: maxYAxis > 50 ? 50 : 10
      },
    ],

    xAxis: {
      title: {
        text: xAxisTitle
      },
      min: minXAxis,
      max: maxXAxis,
      endOnTick: false,
    },

    tooltip: tooltip(xAxisTitle, yAxisTitle),

    plotOptions: {
      series: {
        marker: {
          enabled: false
        }
      }
    },

    exporting: {
        filename: fileName,
        ////// should be like total course chaufeur debut fin.
        csv: {
            filename: fileName
        }
    },

    series: highchartSeries,
    error
  }
}
