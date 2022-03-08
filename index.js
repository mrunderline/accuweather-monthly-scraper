'use-strict'
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// main methods
async function main() {
  const monthlyUrl = validateInput(process.argv);
  console.log(`fetching data from: ${monthlyUrl}`);

  // monthlyPageSelector
  const $ = await fetchPage(monthlyUrl);

  const daysPromise = [];
  $('div.monthly-calendar-container div.monthly-calendar a:not(.is-past)').each((i, element) => {
    const dayUrl = absoluteUrl($(element).attr('href'));
    daysPromise.push(extractDayDetail(dayUrl));
    console.log(1111111111, dayUrl);
  });

  const days = {};
  let errCounter = 0;
  const daysResult = await Promise.allSettled(daysPromise);
  daysResult.forEach(result => {
    if (result.status === 'fulfilled') {
      const date = result.value.date;
      delete result.value.date;
      days[date] = result.value;
    } else {
      errCounter += 1;
      days[`err${errCounter}`] = result;
    }
  });

  const output = {
    url: monthlyUrl,
    result: {
      days
    }
  };

  fs.writeFileSync('./data.json', JSON.stringify(output, null, 2), 'utf-8');
}

async function extractDayDetail(dailyUrl) {
  console.log(dailyUrl);
  // dailyPageSelector
  const $ = await fetchPage(dailyUrl);

  const halfDayCardElements = $('div.half-day-card');
  const sunriseSunsetElement = $('div.sunrise-sunset');
  const temperatureHistoryElement = $('div.temp-history');

  return {
    date: $('div.subnav-pagination').text().trim().split(' ').pop(),
    Day: halfDayParser(halfDayCardElements.eq(0)),
    Night: halfDayParser(halfDayCardElements.eq(1)),
    SunriseOrSunset: sunriseOrSunsetParser(sunriseSunsetElement),
    temperatureHistory: temperatureHistoryParser(temperatureHistoryElement),
  };
}

// parsers
function halfDayParser(element) {
  const result = {
    description: element.find('div.phrase').text(),
    iconPath: absoluteUrl(element.find('div.half-day-card-header > img').attr('src'))
  };
  element.find('p.panel-item').each((i, element) => {
    const $ = cheerio.load(element);

    const valueSelector = $('span');
    const value = valueSelector.text();
    valueSelector.remove();
    const key = camelizeText($.text());

    result[key] = value;
  });
  return result;
}

function sunriseOrSunsetParser(element) {
  const panels = element.find('div.panel');
  return {
    Sun: panelParser(panels.eq(0)),
    Moon: panelParser(panels.eq(1)),
  }
}

function panelParser(element) {
  const duration = textCleaner(element.find('div.spaced-content').eq(0).text()).split(' ');
  return {
    duration: `${duration[0]}${upperFirstChar(duration[1])} ${duration[2]}${upperFirstChar(duration[3])}`,
    risingTime: textCleaner(element.find('div.spaced-content').eq(1).text()).split(' ').slice(1).join(' '),
    fallingTime: textCleaner(element.find('div.spaced-content').eq(2).text()).split(' ').slice(1).join(' '),
  };
}

function temperatureHistoryParser(element) {
  const result = {};
  element.find('div.row').each((i, element) => {
    const $ = cheerio.load(element);
    const temperatureElement = $('div.temperature');
    result[camelizeText($('div.label').text())] = {
      low: temperatureElement.first().text(),
      high: temperatureElement.last().text(),
    };
  });
  return result;
}

// utils
async function fetchPage(url) {
  const response = await axios.get(url);
  const html = response.data;
  return cheerio.load(html);
}

function textCleaner(text) {
  if (!text) return text;
  return text.replaceAll('\t', '').replaceAll('\n', ' ').replace(/\s+/g, ' ').trim();
}

function camelizeText(text) {
  if (!text) return text;
  return text.split(' ').map((word, i) => {
    if (i === 0) return word.toLowerCase();
    return upperFirstChar(word);
  }).join('')
}

function upperFirstChar(text) {
  if (!text) return text;
  return text[0].toUpperCase() + text.substring(1)
}

function absoluteUrl(relativeUrl) {
  return `https://www.accuweather.com${relativeUrl}`
}

function validateInput(arguments) {
  const validCommand = 'node index.js {accuweather-monthly-report-url}';
  if (arguments.length < 3)
    throw new Error(`enter url and try "${validCommand}"`);
  else if (arguments.length > 3)
    throw new Error(`invalid argument length, try "${validCommand}"`);

  const url = arguments[2];

  const monthsName = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
    'october', 'november', 'december'];
  const monthsPattern = monthsName.join('|');
  const validUrlPattern = new RegExp(`https:\/\/www\.accuweather\.com.*(${monthsPattern})-weather.*`);
  if (!validUrlPattern.test(url))
    throw new Error(`entered url is invalid, try "${validCommand}"`);

  return url;
}

(async () => {
  await main();
})();
