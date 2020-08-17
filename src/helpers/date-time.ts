export const getDayName = (dateNumber?: number): string  =>{
    let date = dateNumber || new Date(Date.now()).getDay();
    let dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date];
}

export const getSimpleTime = (datetime: Date): string => {
    let date = datetime || new Date(Date.now());
    return getPaddedTime(date.getHours(), date.getMinutes(), 0);
}

export const getModifiedTime = (hours: number, minutes: number): string => {
    let date = new Date(Date.now());
    return getPaddedTime(date.getHours() + hours, date.getMinutes() + minutes, 0);
}

export const getSimpleDate = (datetime?: Date): string => {
    let date = datetime || new Date(Date.now());
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
}

export const getPaddedTime = (hours: number, minutes: number, seconds: number): string => {
    if(minutes === undefined && seconds === undefined) {
        return `${("0" + hours).slice(-2)}:00`;
    } else if (seconds === undefined) {
        return `${("0" + hours).slice(-2)}:${("0" + minutes).slice(-2)}`;
    } else {
        return `${("0" + hours).slice(-2)}:${("0" + minutes).slice(-2)}:${("0" + seconds).slice(-2)}`;
    }
}

export const getRelativeDateTime = (timestring: string): number => {
    let date: Date = new Date(Date.now());
    let time: Array<string> = timestring.split(":");
    date.setHours(0,0,0,0);
    
    return (date.getTime() + (parseInt(time[0]) / 24) * (24 * 3600000) + parseInt(time[1]) * 60000);
}