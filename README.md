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

### Data File Input
In the data file, Chart Reader supports the following data fields: ``number``, ``string``, ``datetime``, ``date``, ``time``.
The engine expects data to be complete and tidy: it does not support missing values.

### Insights List
The insights JSON structure builds on the [d3-annotation spec](https://react-annotation.susielu.com/).
Four fields are necessary for Chart Reader to provide a screen reader experience: 
1. `title` - textual description to be read first. Should summarize the insight as a headline.
2. ``label`` - textual description read second. Should detail the insight, follow a similar format and structure to other insights of the same ``type``
3. ``target`` - the data targeted by the insight, specified by the axis and values under selection

    {
        ...,
        target: {axis: "x", values: ["2020-03-01", "2020-04-10"], series: ["Seattle"]}
    }

4. ``type`` - describes how the insight should be grouped (e.g., "Summary", "Trends"). Insight ``types`` are ``strings`` to be set ad-hoc by including new types in the file: Chart Reader will group any insights together with the same type.


## Contributing

This project welcomes contributions and suggestions.

### Pull request review

Pull requests to this repo will be reviewed, at a minimum, by one member of the Chart Reader research team.

### Contribution requirements

Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.