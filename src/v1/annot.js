// From https://github.com/susielu/react-annotation/blob/master/src/components/Note/Note.js

const getOuterBBox = (...domNodes) => {
    return [...domNodes].reduce(
        (p, c) => {
            if (c) {
                const bbox = c.getBBox();
                p.x = Math.min(p.x, bbox.x);
                p.y = Math.min(p.y, bbox.y);
                p.width = Math.max(p.width, bbox.width);
                const yOffset = c && c.attributes && c.attributes.y;
                p.height = Math.max(
                    p.height,
                    ((yOffset && parseFloat(yOffset.value)) || 0) + bbox.height
                );
            }
            return p;
        },
        { x: 0, y: 0, width: 0, height: 0 }
    );
};
const leftRightDynamic = (align, y) => {
    if (
        !align ||
        align === 'dynamic' ||
        align === 'left' ||
        align === 'right'
    ) {
        if (y < 0) {
            align = 'top';
        } else {
            align = 'bottom';
        }
    }
    return align;
};

const topBottomDynamic = (align, x) => {
    if (
        !align ||
        align === 'dynamic' ||
        align === 'top' ||
        align === 'bottom'
    ) {
        if (x < 0) {
            align = 'right';
        } else {
            align = 'left';
        }
    }
    return align;
};

const alignment = ({
    padding = 0,
    bbox = { x: 0, y: 0, width: 0, height: 0 },
    align,
    orientation,
    offset = { x: 0, y: 0 },
}) => {
    let x = -bbox.x;
    let y = -bbox.y;
    if (orientationTopBottom.indexOf(orientation) !== -1) {
        align = topBottomDynamic(align, offset.x);
        if (
            (offset.y < 0 && orientation === 'topBottom') ||
            orientation === 'top'
        ) {
            y -= bbox.height + padding;
        } else {
            y += padding;
        }

        if (align === 'middle') {
            x -= bbox.width / 2;
        } else if (align === 'right') {
            x -= bbox.width;
        }
    } else if (orientationLeftRight.indexOf(orientation) !== -1) {
        align = leftRightDynamic(align, offset.y);
        if (
            (offset.x < 0 && orientation === 'leftRight') ||
            orientation === 'left'
        ) {
            x -= bbox.width + padding;
        } else {
            x += padding;
        }

        if (align === 'middle') {
            y -= bbox.height / 2;
        } else if (align === 'top') {
            y -= bbox.height;
        }
    }

    return { x, y };
};

const horizontalLine = ({ align, x = 0, y = 0, offset, bbox }) => {
    align = topBottomDynamic(align, offset.x);

    if (align === 'right') {
        x -= bbox.width;
    } else if (align === 'middle') {
        x -= bbox.width / 2;
    }

    const data = [
        [x, y],
        [x + bbox.width, y],
    ];
    return data;
};

const elbowLine = ({
    dx,
    dy,
    radius,
    outerRadius,
    radiusPadding,
    width,
    height,
}) => {
    let x1 = 0,
        x2 = dx,
        y1 = 0,
        y2 = dy;

    if (width && height) {
        if ((width > 0 && dx > 0) || (width < 0 && dx < 0)) {
            if (Math.abs(width) > Math.abs(dx)) {
                x1 = width / 2;
            } else {
                x1 = width;
            }
        }
        if ((height > 0 && dy > 0) || (height < 0 && dy < 0)) {
            if (Math.abs(height) > Math.abs(dy)) {
                y1 = height / 2;
            } else {
                y1 = height;
            }
        }
        if (x1 === width / 2 && y1 === height / 2) {
            x1 = x2;
            y1 = y2;
        }
    }

    let data = [
            [x1, y1],
            [x2, y2],
        ],
        diffY = y2 - y1,
        diffX = x2 - x1,
        xe = x2,
        ye = y2;

    let opposite = (y2 < y1 && x2 > x1) || (x2 < x1 && y2 > y1) ? -1 : 1;

    if (Math.abs(diffX) < Math.abs(diffY)) {
        xe = x2;
        ye = y1 + diffX * opposite;
    } else {
        ye = y2;
        xe = x1 + diffY * opposite;
    }

    if (outerRadius || radius) {
        const r = (outerRadius || radius) + (radiusPadding || 0);
        const length = r / Math.sqrt(2);

        if (Math.abs(diffX) > length && Math.abs(diffY) > length) {
            x1 = length * (x2 < 0 ? -1 : 1);
            y1 = length * (y2 < 0 ? -1 : 1);
            data = [
                [x1, y1],
                [xe, ye],
                [x2, y2],
            ];
        } else if (Math.abs(diffX) > Math.abs(diffY)) {
            const angle = Math.asin(-y2 / r);
            x1 = Math.abs(Math.cos(angle) * r) * (x2 < 0 ? -1 : 1);
            data = [
                [x1, y2],
                [x2, y2],
            ];
        } else {
            const angle = Math.acos(x2 / r);
            y1 = Math.abs(Math.sin(angle) * r) * (y2 < 0 ? -1 : 1);
            data = [
                [x2, y1],
                [x2, y2],
            ];
        }
    } else {
        data = [
            [x1, y1],
            [xe, ye],
            [x2, y2],
        ];
    }
    return data;
};

const orientationTopBottom = ['topBottom', 'top', 'bottom'];
const orientationLeftRight = ['leftRight', 'left', 'right'];

export {
    getOuterBBox,
    leftRightDynamic,
    topBottomDynamic,
    alignment,
    horizontalLine,
    elbowLine,
};
