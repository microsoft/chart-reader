---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

## Keyboard Interaction Guide

<table>
    <thead>
        <tr>
            <th scope="col">Command</th>
            <th scope="col">Result</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><span class="keycap" role="img" aria-label="Enter Key">Enter</span> on the chart or grouping.</td>
            <td>Enter the chart or drill down a level.</td>
        </tr>
        <tr>
            <td><span class="keycap" role="img" aria-label="Escape Key">Esc</span> on grouping.</td>
            <td>Drill up a level.</td>
        </tr>
        <tr>
            <td><span class="keycap" role="img" aria-label="Tab Key">Tab</span> at any time.</td>
            <td>Exit the chart.</td>
        </tr>
        <tr>
            <td><span class="keycap" role="img" aria-label="Arrow Left">←</span> or <span class="keycap" role="img" aria-label="Arrow Right">→</span> on grouping or day.</td>
            <td>Move among sibling groupings or days.</td>
        </tr>
        <tr>
            <td><span class="keycap" role="img" aria-label="Enter Key">Enter</span> and <span class="keycap" role="img" aria-label="Shift Key">Shift</span> on grouping.</td>
            <td>Play/pause data sonification of the grouping.</td>
        </tr>
    </tbody>
</table>

## Example Chart: COVID-19 Cases in the United States

This chart communicates reported COVID-19 cases as a 7-day rolling average.
The original [dataset](https://github.com/nytimes/covid-19-data) and [chart design](https://www.nytimes.com/interactive/2021/us/covid-cases.html) both come from the New York Times.

<figure style="margin: 0;">
    <div 
        id="chart-cases-container"
        style="height: 400px;
            width: 100%;
            position: relative;"></div>
</figure>

<figure style="margin: 0;">
    <div 
        id="chart-vaccination-container"
        style="height: 400px;
            width: 100%;
            position: relative;"></div>
</figure>

<figure style="margin: 0;">
    <div 
        id="chart-pothole-container"
        style="height: 400px;
            width: 100%;
            position: relative;"></div>
</figure>

<script src="./js-build/v1.bundle.js"></script>

<script>

    var rect = document.getElementById('chart-cases-container').getBoundingClientRect();

    const dimensions = {
        width: rect.width,
        height: rect.height,
        margin: { l: 60, r: 40, t: 60, b: 40 },
    };

    const config = {
        color: {
            'primary': 'rgba(207, 17, 17, 1)',
            'primaryfade': 'rgba(236, 160, 160, 1)',
            'secondary': 'rgba(207, 17, 17, 0.14)',
            'secondaryfade': 'rgba(207, 17, 17, 0.05)',
        },
        x: {
            'name': 'date',
            'label_group': 'average cases',
            'label_axis': 'Days from pandemic start →',
            'encode': 'x',
            'type': 'date',
            'aggregate': ['MEAN', 'MAX', 'MIN', 'COUNT'],
            'period': 'Day', // Maps to d3.timeDay or d3.timeMonth
            'interval': 'Month',
        },
        y: {
            'name': 'cases_avg',
            'label_group': 'cases',
            'label_tooltip': 'Daily average: ',
            'label_axis': 'Reported cases as 7-day average ↑',
            'encode': 'y',
            'type': 'number',
            'aggregate': ['CONSECUTIVE_DAYS', 'COUNT'],
            'interval': 100e3,
        },
    };

    const dataConfig = {
        'annotations': { 'url': './assets/chart/us_covid_cases.js' },
        
        'raw': {
            'url': './assets/chart/us_covid_cases.csv',
            'fields': [
                { 'name': 'date', 'type': 'date', 'format': '%Y-%m-%d' },
                { 'name': 'geoid', 'type': 'string' },
                { 'name': 'cases', 'type': 'number' },
                { 'name': 'cases_avg', 'type': 'number' },
                { 'name': 'cases_avg_per_100k', 'type': 'number' },
                { 'name': 'deaths', 'type': 'number' },
                { 'name': 'deaths_avg', 'type': 'number' },
                { 'name': 'deaths_avg_per_100k', 'type': 'number' },
            ],
        },
    };

    lineChart = new v1.Chart('#chart-cases-container', config, dimensions, dataConfig);

</script>

<script>

    var rectVax = document.getElementById('chart-vaccination-container').getBoundingClientRect();

    const dimVax = {
        width: rectVax.width,
        height: rectVax.height,
        margin: { l: 60, r: 40, t: 60, b: 40 },
    };

    const configVax = {
        color: {
            'primary': 'rgba(46, 114, 101, 1)',
            'primaryfade': 'rgba(76, 190, 167, 1)',
            'secondary': 'rgba(46, 114, 101, 0.14)',
            'secondaryfade': 'rgba(46, 114, 101, 0.05)',
        },
        x: {
            'name': 'date',
            'encode': 'x',
            'type': 'date',
            'label_group': 'average vaccinations',
            'label_axis': 'Time (in days) →',
            'aggregate': ['MEAN', 'MAX', 'MIN', 'COUNT'],
            'period': 'Day', // Maps to d3.timeWeek or d3.timeMonth
            'interval': 'Month',
        },
        y: {
            'name': 'daily_vaccinations',
            'encode': 'y',
            'type': 'number',
            'label_tooltip': 'Daily average: ',
            'label_group': 'vaccinations',
            'label_axis': 'Daily vaccinations as 7-day average ↑',
            'aggregate': ['CONSECUTIVE_DAYS', 'COUNT'],
            'interval': 500e3,
        },
    };

    const dataConfigVax = {
        'annotations': { 'url': './assets/chart/us_covid_vaccinations.js' },
        'raw': {
            'url': './assets/chart/us_covid_vaccinations.csv',
            'filters': [],
            'fields': [
                { 'name': 'date', 'type': 'date', 'format': '%Y-%m-%d' },
                { 'name': 'daily_vaccinations', 'type': 'number' },
            ],
        },
    };

    vaxChart = new v1.Chart('#chart-vaccination-container', configVax, dimVax, dataConfigVax);

</script>

<script>

    var rectVax = document.getElementById('chart-pothole-container').getBoundingClientRect();

    const dimPh = {
        width: rectVax.width,
        height: rectVax.height,
        margin: { l: 60, r: 40, t: 60, b: 40 },
    };

    const configPh = {
        color: {
            'primary': 'rgba(46, 114, 101, 1)',
            'primaryfade': 'rgba(76, 190, 167, 1)',
            'secondary': 'rgba(46, 114, 101, 0.14)',
            'secondaryfade': 'rgba(46, 114, 101, 0.05)',
        },
        x: {
            'name': 'date',
            'encode': 'x',
            'type': 'date',
            'label_axis': 'Time (in months) →',
            'label_group': 'average potholes',
            'aggregate': ['MEAN', 'MAX', 'MIN', 'COUNT'],
            'period': 'Month', // Maps to d3.timeWeek or d3.timeMonth
            'interval': 'Year',
        },
        y: {
            'name': 'count',
            'encode': 'y',
            'type': 'number',
            'label_tooltip': 'Potholes: ',
            'label_axis': 'Number of pothole reports per week in Seattle ↑',
            'label_group': 'potholes',
            'aggregate': ['CONSECUTIVE_DAYS', 'COUNT'],
            'interval': 200,
        },
    };

    const dataConfigPh = {
        'annotations': { 'url': './assets/chart/seattle_potholes.js' },
        'raw': {
            'url': './assets/chart/seattle_potholes.csv',
            'filters': [],
            'fields': [
                { 'name': 'date', 'type': 'date', 'format': '%Y-%m-%d' },
                { 'name': 'count', 'type': 'number' },
            ],
        },
    };

    new v1.Chart('#chart-pothole-container', configPh, dimPh, dataConfigPh);

</script>
