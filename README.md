# Chart Reader

Web-accessibility engine for rendering accessible, interactive charts optimized for screen reader users.

## Source Code

Resides in the `./src/` directory. This engine is built from source code using `npm` or `yarn`. The build outputs to `./build/` as bundled `*.js` file.

## Install and Build

This repository requires the [yarn](https://classic.yarnpkg.com/en/docs/install) package manager.

Then install the package dependencies and build the Chart Reader engine:

1. `yarn install`
2. `yarn run build` builds to `./build/` as bundled `*.js` file.

## Dependencies

Chart Reader is created with open source libraries, using [d3](https://github.com/d3/d3) for data binding and a modified version of [susielu/react-annotation](https://github.com/susielu/react-annotation) for annotation layout.

## How to use

Chart Reader is an accessibility engine that renders an SVG chart to a web page using __three inputs:__

1. __a data file__ in CSV format
2. __an insights list__ in JSON format
3. __a Chart Reader configuration__ in JSON format

The __data file__ and __insights list__ describe the content of the accessible chart, while the __Chart Reader configuration__ declares how the chart renders the accessible experience.

The documentation uses a multi-series line chart about "Potholes Reported in Seattle and Atlanta" as an example.

### Data File Input

For the input CSV data file, Chart Reader supports the following data fields: ``number``, ``string``, ``datetime``, ``date``, ``time``.
The engine expects data to be complete and tidy: it does not support missing values.

### Insights List

The insights JSON structure is inspired by the [d3-annotation spec](https://react-annotation.susielu.com/).
Four fields are necessary for Chart Reader to include insights:

1. ``title`` - textual description to be read first. The ``title`` should summarize the insight as a headline.

2. ``label`` - textual description read second. Details the insight content. Each insight should follow a similar format and structure to other insights of the same ``type``

```json
    {
        "note": {
            "title": [
                "Most Potholes Reported in New York, 2018"
            ],
            "label": [
                "In the winter of 2018, New York sees its largest number of ",
                "potholes reported, reaching a peak of close to 3500 potholes in March. "
            ]
        },
    }
```

3. ``target`` - the data targeted by the insight, specified by the axis and values under selection.

```json
    {
        "target": {
            "axis": "x",
            "values": ["2020-03-01", "2020-04-10"],
            "series": ["Seattle"]
        },
    }
```

  a. ``axis`` - the axis to make the target selection along. Restricted to ``x`` and ``y`` literals.
  b. ``values`` - an array that selects the target values. Should be ``start`` and ``end`` values of a range for linear data (e.g., ``number``, ``datetime``, ``date``, ``time``). Should be ``unique`` list of values in the case ``string`` data.
  c. ``series`` - an array that selects which series to include. _Only for multi-series charts._

4. ``type`` - describes how the insight should be grouped (e.g., "Summary", "Trends", "Landmarks", "Statistics"). Insight ``types`` are ``strings`` to be set ad-hoc by including new types in the file: Chart Reader will group any insights together with the same type.

```json
    {
        "type": "landmarks",
    }
```

5. ``dx`` and ``dy``- _optional fields_ that relatively place the visual text of the insight with respect to the ``target``.

```json
    {
        "dx": 30,
        "dy": -60,
    }
```

### Chart Reader Configuration

Chart Reader supports four chart types: single-series line, multi-series line, stacked bar, and grouped bar. The configuration is a JSON object that declares the encodings of the chart. The configuration is flexible in how it encodes data, which data types are suppported, and how values can be read by the Screen Reader.

The configuration requires ``description``, ``insights``, and ``data`` objects that describe the makeup of the chart.

1. ``description`` - describes the ``title`` used to first announce the chart, and the ``caption`` used to describe the syntactic aspects of the chart. Note that the summary insight goes into more detail about describing the chart's content.

```json
    {
        "description": {
            "title": "Potholes Reported in Seattle and New York City",
            "caption": "Line chart displaying potholes reported each month in Seattle and New York City (NYC) from January 2017 to March 2022."
        },
    }
```

2. ``insights`` - a ``url`` pointing towards the JSON file containing the Insights List described above.

```json
     {
        "annotations": {
            "url": "./assets/chart/seattle_and_nyc_pothole_insights.json"
        },
     }
```

3. ``data`` - describes the input data in a digestible format for Chart Reader. This JSON Object includes the ``url`` to the CSV data file and how to parse the data ``fields``. Each ``field`` includes an object describing the ``name`` of a column in the CSV data file, the data ``type``, and the ``format``. The ``format`` is only required for ``datetime``, ``date``, or ``time`` data and follows [d3 time format](https://github.com/d3/d3-time-format).
    
```json
    {
        "data": {
            "url": "./assets/chart/seattle_and_nyc_potholes.csv",
            "fields": [
                {
                    "name": "date",
                    "type": "date",
                    "format": "%Y-%m-%d"
                },
                {
                    "name": "seattle",
                    "type": "number"
                },
                {
                    "name": "nyc",
                    "type": "number"
                }
            ]
        },
    }
```

The configuration also includes encoding attributes for ``x``, ``y``, and ``z`` axes, respectively. The ``x`` and ``y`` objects are required for all chart types, while the ``z`` object is only required for multi-series charts.

4. ``x``, ``y``, ``z`` - describes the encoding of the along that axis. The object includes the ``name`` of the column in the CSV data file, the ``type`` of data, the ``label_axis`` to be read by the Screen Reader, the ``label_group`` to be read by the Screen Reader, the ``aggregate`` function to be applied to the data, and the ``period`` to describe equally spaced temporal data, and ``interval`` to be used to ``aggregate`` along the axis. The ``period`` is only required for ``datetime``, ``date``, or ``time`` data.

```json
    {
        "x": {
            "name": "date",
            "type": "date",
            "label_axis": "Time (in months)",
            "label_group": "average potholes",
            "aggregate": ["mean"],
            "period": "Month",
            "interval": "Year",
        },
        "z": {
            "name": "city",
            "type": "string",
            "label_axis": "City",
            "map": {
                "sea": "Seattle",
                "nyc": "New York City"
            }
        }
    }
```

- ``name`` - the name of the column in the CSV data file.
- ``type`` - the type of data. Supported types are ``number``, ``string``, ``datetime``, ``date``, and ``time``.
- ``label_axis`` - the label to be read by the Screen Reader for the axis and displayed as text.
- ``label_group`` - the label to be read by the Screen Reader for the aggregated group.
- ``aggregate`` - the function to be applied to the data binned by the ``interval``. Supported functions are ``mean``, ``median``, ``min``, ``max``, ``sum``, ``count``, ``consecutive_time``.
- ``period`` - the period to describe equally spaced temporal data. Supported periods are ``Month``, ``Year``, ``Week``, ``Day``, ``Hour``, ``Minute``, ``Second``.
- ``interval`` - the interval to be used to ``aggregate`` along the axis. Supported intervals are ``Month``, ``Year``, ``Week``, ``Day``, ``Hour``, ``Minute``, ``Second`` for ``time`` data. Should be a larger interval than the ``period``. For ``number`` data, the provided number is used ``aggregate`` by binning.
- ``map`` - a mapping of the ``string`` data to be read by the Screen Reader. The keys are the values in the CSV data file, and the values are the text to be read by the Screen Reader.  only required for ``string`` data.

## Contributing

This project welcomes contributions and suggestions.

### Pull request review

Pull requests to this repo will be reviewed, at a minimum, by one member of the Chart Reader research team.

### Contribution requirements

Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit <https://cla.opensource.microsoft.com>.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
