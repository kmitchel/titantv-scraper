const { create } = require('xmlbuilder2');
const { getChannels, getProgramsForChannel } = require('./db');
const dayjs = require('dayjs');

function generateXMLTV() {
    const root = create({ version: '1.0' }).ele('tv');

    const channels = getChannels();
    for (const channel of channels) {
        const chEle = root.ele('channel', { id: channel.channel_number });
        chEle.ele('display-name').txt(`${channel.channel_number} ${channel.callsign}`);
        if (channel.logo_url) {
            chEle.ele('icon', { src: channel.logo_url });
        }
    }

    // Get programs for next 24 hours (or whatever is in DB)
    const start = dayjs().subtract(2, 'hours').unix(); // Buffer
    const end = dayjs().add(7, 'day').unix();

    for (const channel of channels) {
        const programs = getProgramsForChannel(channel.id, start, end);
        for (const prog of programs) {
            const progEle = root.ele('programme', {
                start: dayjs.unix(prog.start_time).format('YYYYMMDDHHmmss ZZ'),
                stop: dayjs.unix(prog.end_time).format('YYYYMMDDHHmmss ZZ'),
                channel: channel.channel_number
            });
            progEle.ele('title').txt(prog.title);
            if (prog.sub_title) progEle.ele('sub-title').txt(prog.sub_title);
            if (prog.description) progEle.ele('desc').txt(prog.description);
            if (prog.image_url) {
                progEle.ele('icon', { src: prog.image_url });
            }
        }
    }

    return root.end({ prettyPrint: true });
}

module.exports = { generateXMLTV };
