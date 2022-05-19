import * as d3 from 'd3';

const parseDate = d3.timeParse('%Y-%m-%d');
const convertToClass = (value) => value;

const loadDataCsv = async (dataUrl, dataFields) => {
    const parseFields = dataFields.map((field) => {
        let parse = (d) => d[field.name];
        switch (field.type) {
            case 'date':
                const parseFormat = d3.timeParse(field.format);
                parse = (d) => parseFormat(d[field.name]);
                break;
            case 'number':
                parse = (d) => parseFloat(d[field.name]);
                break;
        }
        return { 'name': field.name, 'parse': parse };
    });

    let raw = await d3.csv(dataUrl, (d) => {
        let row = {};
        parseFields.forEach((pf) => {
            row[pf.name] = pf.parse(d);
        });
        return row;
    });

    console.log(raw);

    return raw;
};

const loadAnnotations = async (annotationUrl) => {
    const annotations = await d3.json(annotationUrl);
    return annotations;
};

export { parseDate, convertToClass, loadDataCsv, loadAnnotations };
