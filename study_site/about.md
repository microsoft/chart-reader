---
layout: page
title: About
permalink: /about/
---

By: [John Thompson](mailto:johnthompson@microsoft.com), [Bongshin Lee](mailto:bongshin@microsoft.com), and [Ed Cutrell](mailto:cutrell@microsoft.com) of  Microsoft Research; and [Alper Sarikaya](mailto:Alper.Sarikaya@microsoft.com) of Microsoft Power BI.

We explore innovative solutions for accessible data visualization that provide interactive, information layers to communicate data.
Users can navigate the layers with keyboard interactions and a screen reader.

__The Problem:__ Currently, data visualizations on the web are inaccessible to screen reader users.
Visualizations are often handled by screen readers as an image and described by alternative text ("alt-text").
Alternative descriptions only meet the floor requirement for accessibly communicating data.
Descriptions are summative - they describe the most important insights, neglecting details and nuance.
They are subjective - the author decides what is the most important message to convey.
And alternative text lacks connection to the underlying data - users cannot investigate or explore the data further.
The ceiling for accessible data visualization should address these shortcomings through interaction.

<b>The Solution:</b> The current ceiling for accessible data visualization provides exploratory interaction.
For example, accessible interactive charting libraries such as [High Charts](https://www.highcharts.com/accessibility) or [Visa Chart Components](https://developer.visa.com/pages/chart-components) provide keyboard navigation of charts via data points or data series.
However, this form of interaction only supports exploration at the lowest information level - for each individual data point.
The user must read each individual data point to come to an understanding of the data, similar to reading an entire data table.
This is a tedious and cognitively difficult method of data exploration.
Instead, we envision augmenting accessible charts with additional interactive, information layers.
These additional layers provide varying levels of communicative intent to explore.
In the following chart we provide an example of this approach.
We add the capability to keyboard navigate the following information layers:

1. _Insights_ such as trends, outliers, extrema, or anomalies of the dataset. The underlying data points can be explored for each insight.
2. _Axes and Legends_ are the substrate that make up a chart. Slices or bins of each axis or legend provide a summative layer to explore data.
3. _Data Points_ are the individual rows of the data to be explored.