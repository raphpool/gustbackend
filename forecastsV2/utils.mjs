export function isWithinTimeRange(date, modelName, hoursElapsed) {
    let hour = new Date(date).getUTCHours();
    let isWithinHourRange = hour >= 6 && hour <= 22;

    if (modelName === 'meteofrance_arome_france_hd') {
        return isWithinHourRange;
    } else if (hour % 2 === 0) {
        return isWithinHourRange;
    }
    return false;
}

export function getWindDirection(degrees) {
    if (degrees >= 337.5 || degrees < 22.5) return 'North';
    if (degrees >= 22.5 && degrees < 67.5) return 'North-east';
    if (degrees >= 67.5 && degrees < 112.5) return 'East';
    if (degrees >= 112.5 && degrees < 157.5) return 'South-east';
    if (degrees >= 157.5 && degrees < 202.5) return 'South';
    if (degrees >= 202.5 && degrees < 247.5) return 'South-west';
    if (degrees >= 247.5 && degrees < 292.5) return 'West';
    return 'North-west';
}

export function isDaylightSavingTimeParis(date) {
    // Typically, DST starts on the last Sunday in March and ends on the last Sunday in October for Paris
    const startDST = new Date(Date.UTC(date.getFullYear(), 2, 31)); // March 31st
    const endDST = new Date(Date.UTC(date.getFullYear(), 9, 31)); // October 31st
    // Find the last Sunday
    startDST.setUTCDate(startDST.getUTCDate() - startDST.getUTCDay());
    endDST.setUTCDate(endDST.getUTCDate() - endDST.getUTCDay());
    return date >= startDST && date < endDST;
}

export function getRelativeDirection(spotDirection, windDirection) {
    const matrix = {
        'North': {
            'North': 'onshore',
            'North-east': 'side-onshore',
            'East': 'sideshore',
            'South-east': 'side-offshore',
            'South': 'offshore',
            'South-west': 'side-offshore',
            'West': 'sideshore',
            'North-west': 'side-onshore'
        },
        'South': {
            'North': 'offshore',
            'North-east': 'side-offshore',
            'East': 'sideshore',
            'South-east': 'side-onshore',
            'South': 'onshore',
            'South-west': 'side-onshore',
            'West': 'sideshore',
            'North-west': 'side-offshore'
        },
        'East': {
            'North': 'sideshore',
            'North-east': 'onshore',
            'East': 'onshore',
            'South-east': 'side-onshore',
            'South': 'sideshore',
            'South-west': 'side-offshore',
            'West': 'offshore',
            'North-west': 'side-offshore'
        },
        'West': {
            'North': 'sideshore',
            'North-east': 'side-offshore',
            'East': 'offshore',
            'South-east': 'side-offshore',
            'South': 'sideshore',
            'South-west': 'side-onshore',
            'West': 'onshore',
            'North-west': 'side-onshore'
        },
        'North-east': {
            'North': 'side-onshore',
            'North-east': 'onshore',
            'East': 'side-onshore',
            'South-east': 'sideshore',
            'South': 'side-offshore',
            'South-west': 'offshore',
            'West': 'side-offshore',
            'North-west': 'sideshore'
        },
        'South-east': {
            'North': 'side-offshore',
            'North-east': 'sideshore',
            'East': 'side-onshore',
            'South-east': 'onshore',
            'South': 'side-onshore',
            'South-west': 'sideshore',
            'West': 'side-offshore',
            'North-west': 'offshore'
        },
        'North-west': {
            'North': 'side-onshore',
            'North-east': 'sideshore',
            'East': 'side-offshore',
            'South-east': 'offshore',
            'South': 'side-offshore',
            'South-west': 'sideshore',
            'West': 'side-onshore',
            'North-west': 'onshore'
        },
        'South-west': {
            'North': 'side-offshore',
            'North-east': 'offshore',
            'East': 'side-offshore',
            'South-east': 'sideshore',
            'South': 'side-onshore',
            'South-west': 'onshore',
            'West': 'side-onshore',
            'North-west': 'sideshore'
        }
    };

    // Safeguards
    if (!matrix[spotDirection]) {
        console.error(`Invalid spotDirection: ${spotDirection}`);
        return 'unknown';
    }
    if (!matrix[spotDirection][windDirection]) {
        console.error(`Invalid windDirection: ${windDirection} for spotDirection: ${spotDirection}`);
        return 'unknown';
    }
    return matrix[spotDirection][windDirection];
}