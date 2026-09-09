import moment           from 'moment-timezone';
import Highcharts       from 'highcharts';
import { max, min } from 'lodash'


export default function(data, filter, t, fileName) {
  //   init
  let minDate;
  let maxDate;
  let error = false;


  // Define axes title
  let xAxisTitle = t("octavi:Date")
  if (filter.options.temporalOption) {
    if (filter.options.temporalOption != 'none') {
      xAxisTitle += ' (' + t("octavi:" + filter.options.temporalOption.slice(2)) + ')'
    }
  }

  let yAxisTitle = t(`octavi:widgets:${filter.object}:object`)
  yAxisTitle = yAxisTitle.charAt(0).toUpperCase() + yAxisTitle.slice(1)


  // Compute first serie variables
  const countsFilterOne = data.valueFilterOne.counts || {};
  if (data.valueFilterOne.status === 'error') {
    error = true;
  }

  const series = {first:[]}
  for (let i in Object.keys(countsFilterOne)) {
      let date = Object.keys(countsFilterOne)[i];
      series['first'].push([moment(date).unix()*1000, countsFilterOne[date]]);
  }
  const minDateFilterOne = min(series['first'].map(x => x[0])) - 24 * 3600 * 1000;
  const maxDateFilterOne = max(series['first'].map(x => x[0])) + 24 * 3600 * 1000;


  // Compute second serie variables
  if (data.valueFilterTwo) {
    const countsFilterTwo = data.valueFilterTwo.counts || {};
    if (data.valueFilterTwo.status === 'error') {
        error = true;
    }

    series.second = [];
    for (let i in Object.keys(countsFilterTwo)) {
        let date = Object.keys(countsFilterTwo)[i];
        series['second'].push([moment(date).unix()*1000, countsFilterTwo[date]]);
    }

    const minDateFilterTwo = min(series['second'].map(x => x[0])) - 24 * 3600 * 1000;
    const maxDateFilterTwo = max(series['second'].map(x => x[0])) + 24 * 3600 * 1000;

    //global varaibles
    minDate = min([minDateFilterOne, minDateFilterTwo]);
    maxDate = max([maxDateFilterOne, maxDateFilterTwo]);

  } else {
    //global varaibles

    minDate = minDateFilterOne;
    maxDate = maxDateFilterOne;
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
                name: `${yAxisTitle} : Seconde période`,
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


  // build datetime handlers
  const getWeekNumber = function(x) {
    const d = new Date(x)
    return Math.ceil((((d - new Date(d.getFullYear(),0,1,-2)) / 86400000) + 1)/ 7)
  }

  const tooltip = function(temporalOption, t) {
    switch(temporalOption) {
        case "byWeek":
            return {
                formatter: function() {
                    return `${t('octavi:Week')} ${getWeekNumber(this.x)}, ${new Date(this.x).getFullYear()}<br><b>${this.y} ${t(`octavi:widgets:${filter.object}:object`)}</b>`
                }
            };

        case "byMonth":
            return {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat:  `{point.x:%b, %Y}<br><b>{point.y} ${t(`octavi:widgets:${filter.object}:object`)}</b>`
            };

        default:
            return {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat:  `{point.x:%e %b %Y}<br><b>{point.y} ${t(`octavi:widgets:${filter.object}:object`)}</b>`
            };
    }
  }

  const xAxisDatetimeFormatter = function(temporalOption, t) {
    switch(temporalOption) {
      case "byWeek":
        return {
          staggerLines: 2,
          formatter: function() {
            return Highcharts.dateFormat(t('octavi:WeekFrom') + ' %e %B', this.value)
          }
        };

      case "byMonth":
        return {
          formatter: function() {
            return Highcharts.dateFormat('%B %Y', this.value)
          }
        };

      default:
        return {
          formatter: function() {
            return Highcharts.dateFormat('%e %b', this.value)
          }
        };
    }
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
        // max: maxYAxis,
        // tickinterval: 50
      },
    ],

    xAxis: {
      title: {
        text: xAxisTitle
      },
      type: 'datetime',
      labels : xAxisDatetimeFormatter(filter.options.temporalOption, t),
      min: minDate,
      max: maxDate,
    },

    tooltip: tooltip(filter.options.temporalOption, t),

    plotOptions: {
      series: {
        marker: {
          enabled: true
        }
      }
    },

    exporting: {
        filename: fileName,
        csv: {
            filename: fileName
        }
    },

    series: highchartSeries,
    error
  }
}
