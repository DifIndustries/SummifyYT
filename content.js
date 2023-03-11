// Get the root element
const root = document.documentElement;

// Define the CSS variables
const lightTheme = {
  subgroupHeaderBackground: '#FFFFFF',
  subgroupSummaryBackground: '#F7F7F8'
};

const darkTheme = {
  subgroupHeaderBackground: '#343541',
  subgroupSummaryBackground: '#444654'
};

// Detect the current theme setting
const isDarkTheme = root.getAttribute('dark') !== null;

// Set the CSS variables based on the current theme setting
if (isDarkTheme) {
  root.style.setProperty('--subgroup-header-container-backgroundcolor', darkTheme.subgroupHeaderBackground);
  root.style.setProperty('--subgroup-summary-container-backgroundcolor', darkTheme.subgroupSummaryBackground);
} else {
  root.style.setProperty('--subgroup-header-container-backgroundcolor', lightTheme.subgroupHeaderBackground);
  root.style.setProperty('--subgroup-summary-container-backgroundcolor', lightTheme.subgroupSummaryBackground);
}
const API_KEY = 'YOUR API KEY';

let MAX_RESULTS = 100;
let pageToken;
let numberOfComments;

async function getComments() {
  let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${API_KEY}&maxResults=${MAX_RESULTS}`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }

  let response = null;
  let data = null;

  try {
    response = await fetch(url);
    data = await response.json();
    if (data.error) {
      console.log(data.error.message);
    }
  } catch (error) {
    console.error(error);
  }
  return data;
}

async function setNumberOfComments() {
  let url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`;

  let response = null;
  let data = null;

  try {
    response = await fetch(url);
    data = await response.json();
    if (data.error) {
      console.log(data.error.message);
    }
  } catch (error) {
    console.error(error);
  }

  const videoData = data.items[0];
  numberOfComments = videoData.statistics.commentCount;

  const preprocessingLabel = document.getElementById("preprocessingLabel");
  if (preprocessingLabel) {
    preprocessingLabel.innerHTML = "Reading " + numberOfComments + " comments";
  }
}

async function printComments() {
  all_comments = "";
  firstTimestamp = null;
  lastTimestamp = null;

  if (!(numberOfComments > 0)) {
    return [];
  }

  ytb_data = await getComments();

  if (!ytb_data.items) {
    return [];
  }
  for (const comment of ytb_data.items) {
    if (comment.snippet.topLevelComment.snippet.textOriginal.length < 1150) {
      all_comments += (comment.snippet.topLevelComment.snippet.textOriginal) + "\n";
    }
    if (lastTimestamp == null) {
      lastTimestamp = comment.snippet.topLevelComment.snippet.publishedAt;
    }
    firstTimestamp = comment.snippet.topLevelComment.snippet.publishedAt;
  }

  if (all_comments.length > 14850) {
    MAX_RESULTS = MAX_RESULTS - 10;
    return await printComments();
  }

  return { content: all_comments, timestamps: { first: firstTimestamp, last: lastTimestamp } };
}

let content;
let timestamps;

let ytb_data;

let container;
let summaryBox1;
let summaryBoxContent1;
let summaryBox2;
let summaryBoxContent2;

let checkLoginInterval;

let buffer;
let processingGif = document.createElement("img");
let finalSummary;
const port = createPort();

// add event listener for beforeunload event
window.addEventListener("beforeunload", function (event) {
  port.postMessage({ type: "abort" });
});

window.addEventListener('yt-navigate-finish', function (event) {

  port.postMessage({ type: "abort" });

  compose();

});

async function compose() {

  url = document.location.href;
  videoId = url.split('v=')[1];

  if (videoId) {
    videoId = videoId.split('&')[0];

    // Initialize number of comments
    await setNumberOfComments();

    MAX_RESULTS = 100;
    pageToken = null;

    const result = await printComments();

    if (result.content) {
      content = result.content;
      timestamps = result.timestamps;
    }

    // Create a container element to hold the comment summary
    if (document.getElementById("comment-recap")) {

      while (summaryBoxContent1.firstChild) {
        summaryBoxContent1.removeChild(summaryBoxContent1.firstChild);
      }

      finalSummary.innerHTML = "Please wait while your comments are being processed. This may take a few moments, but it will ensure the best possible results for your summaries.";

    } else {
      container = document.createElement('div');
      container.id = 'comment-recap';
      container.className = 'container';

      let parentDiv;

      parentDiv = document.getElementById('always-shown');
      if (parentDiv) {

        parentDiv.appendChild(container);
        createHTML();

      } else {
        console.log("parentDiv is null");
        return;
      }
    }

    if (!(numberOfComments > 0)) {
      container.style.display = "none";
      return;
    } else {
      container.style.display = "block";
    }

    await checkAuth();

  }
}

async function checkAuth() {
  port.postMessage({ type: "getToken" });
}

async function waitForLogin() {

  if (checkLoginInterval) {
    clearInterval(checkLoginInterval);
  }
  checkLoginInterval = setInterval(checkAuth, 5000);

  finalSummary.innerHTML =
    'Please login at <a href="https://chat.openai.com" target="_blank">chat.openai.com</a>';

}

async function start() {

  if (checkLoginInterval) {
    clearInterval(checkLoginInterval);
  }

  finalSummary.innerHTML = "Please wait while your comments are being processed. This may take a few moments, but it will ensure the best possible results for your summaries.";

  if (ytb_data.nextPageToken) {
    summaryBox1.style.display = "block";
    processNextSummary();
  } else {
    summaryBox1.style.display = "none";
    processSingleSummary();
  }
}

function processSingleSummary() {

  if (content.length > 0) {

    buffer = finalSummary;
    port.postMessage({ type: "processSingleSummary", content });

  }
}

async function processNextSummary() {
  if (ytb_data.nextPageToken) {

    const subgroup_container = document.createElement('div');
    subgroup_container.className = 'subgroup_container';

    const subgroup_header_container = document.createElement('div');
    subgroup_header_container.className = 'subgroup_header_container';

    const userProfilePic = document.createElement("img");
    userProfilePic.src = chrome.runtime.getURL("images/userPic.png");

    const summary_header = document.createElement('p');
    summary_header.className = 'pre-summary-text';

    subgroup_header_container.appendChild(userProfilePic);
    subgroup_header_container.appendChild(summary_header);

    const subgroup_summary_n_container = document.createElement('div');
    subgroup_summary_n_container.className = 'subgroup_summary_n_container';

    const gptProfilePic = document.createElement("img");
    gptProfilePic.src = chrome.runtime.getURL("images/chatGptPic.png");

    const summary1 = document.createElement('p');
    summary1.className = 'summary-text';

    subgroup_summary_n_container.appendChild(gptProfilePic);
    subgroup_summary_n_container.appendChild(summary1);

    subgroup_container.appendChild(subgroup_header_container);
    subgroup_container.appendChild(subgroup_summary_n_container);

    summaryBoxContent1.appendChild(subgroup_container);

    const { content, timestamps } = await printComments();

    summary_header.innerHTML = 'Summarize comments from ' + getReadableTimestamp(timestamps.first) + ' to ' + getReadableTimestamp(timestamps.last);
    buffer = summary1;

    port.postMessage({ type: "processingBlocks", content });

    pageToken = ytb_data.nextPageToken;

  } else {

    processingGif.src = chrome.runtime.getURL("images/logo64.png");

    const summaryElements = summaryBoxContent1.querySelectorAll('div > .summary-text');
    let concatenatedText = '';

    summaryElements.forEach(function (summaryElement) {
      concatenatedText = concatenatedText.concat(summaryElement.textContent, '\n');
    });

    if (concatenatedText.length > 0) {

      buffer = finalSummary;
      port.postMessage({ type: "final", content: concatenatedText });

    }
  }
}

function createPort() {
  const port = chrome.runtime.connect();
  port.onMessage.addListener(function (msg) {

    if (msg.text) {

      if (msg.text === "AUTHORIZED") {
        start();
        return;
      }

      buffer.innerHTML = msg.text;

    } else if (msg.error) {

      if (msg.error === "UNAUTHORIZED") {
        waitForLogin();

      } else {
        buffer.innerHTML = '<p class="errore">' + msg.error + '</p>';
      }
    }

    if (msg.end) {
      processNextSummary();
      return;
    }

  });

  return port;
}

function toggleMenu() {
  const hamburger = document.querySelector('.navbar__hamburger');
  hamburger.classList.toggle('active');
  const menu = document.querySelector('.navbar__menu');
  menu.classList.toggle('slide-down');
}

function createHTML() {

  const navbar = document.createElement('div');
  navbar.classList.add('navbar');

  const hamburger = document.createElement('div');
  hamburger.classList.add('navbar__hamburger');
  hamburger.addEventListener('click', toggleMenu);

  const hamburgerLine1 = document.createElement('div');
  hamburgerLine1.classList.add('navbar__hamburger-line');
  if (isDarkTheme) {
    hamburgerLine1.style.background = '#F2F2F2';
  } else {
    hamburgerLine1.style.background = '#272727';
  }
  hamburger.appendChild(hamburgerLine1);

  const hamburgerLine2 = document.createElement('div');
  hamburgerLine2.classList.add('navbar__hamburger-line');
  if (isDarkTheme) {
    hamburgerLine2.style.background = '#F2F2F2';
  } else {
    hamburgerLine2.style.background = '#272727';
  }
  hamburger.appendChild(hamburgerLine2);

  const hamburgerLine3 = document.createElement('div');
  hamburgerLine3.classList.add('navbar__hamburger-line');
  if (isDarkTheme) {
    hamburgerLine3.style.background = '#F2F2F2';
  } else {
    hamburgerLine3.style.background = '#272727';
  }
  hamburger.appendChild(hamburgerLine3);

  navbar.appendChild(hamburger);

  const menu = document.createElement('div');
  menu.classList.add('navbar__menu');
  if (isDarkTheme) {
    menu.style.background = '#272727';
  } else {
    menu.style.background = '#F2F2F2';
  }
  
  navbar.appendChild(menu);

  const row = document.createElement('div');
  row.className = 'menu-row';
  menu.appendChild(row);

  // Create a label element for the combobox
  const languageProp = document.createElement('div');

  const languageLabel = document.createElement('p');
  languageLabel.className = 'language-label';
  languageLabel.textContent = 'Summary language';
  languageLabel.style.marginLeft = '10px';
  languageLabel.style.fontSize = '1.5rem';
  languageLabel.style.fontWeight = 'bold';
  languageProp.appendChild(languageLabel);

  const languageDescription = document.createElement('p');
  languageDescription.textContent = 'The summary language is the language that will be used to summarize the comments. When set to \'Default\',  the most common language in the comments will be used.';
  languageDescription.style.marginLeft = '10px';
  languageDescription.style.marginTop = '2px';
  languageDescription.style.width = '300px';
  languageProp.appendChild(languageDescription);

  // Create a combobox element for selecting the language
  const languageSelect = document.createElement('select');
  if (isDarkTheme) {
    languageSelect.style.background = 'url(https://upload.wikimedia.org/wikipedia/commons/9/9d/Caret_down_font_awesome_whitevariation.svg) no-repeat right 0.8em center/1.4em, linear-gradient(to left, rgba(255, 255, 255, 0.3) 3em, rgba(255, 255, 255, 0.2) 3em)';
    languageSelect.style.color = 'white';
  } else {
    languageSelect.style.background = 'url(https://upload.wikimedia.org/wikipedia/commons/9/9a/Caret_down_font_awesome.svg) no-repeat right 0.8em center/1.4em, linear-gradient(to left, rgba(0, 0, 0, 0.3) 3em, rgba(0, 0, 0, 0.2) 3em)';
    languageSelect.style.color = 'black';
  }
  
  // Create an array of available languages
  const languages = [
    'Default',
    'English',
    'Italiano',
    'Français',
    'Deutsch',
    'Español',
    'Português',
    'Русский',
    '中文',
    '日本語',
    '한국어',
    'عربية',
    'हिन्दी',
    'বাংলা',
    'Bahasa Indonesia',
    'Bahasa Melayu',
    'Tiếng Việt',
    'ไทย',
    'Türkçe'
  ];

  // Loop through the languages array and create an option element for each language
  languages.forEach((language) => {
    const option = document.createElement('option');
    option.value = language;
    if (language === 'عربية') {
      option.style.textAlign = 'right';
    }
    option.textContent = language;
    if (isDarkTheme) {
      option.style.backgroundColor = '#272727';
    } else {
      option.style.backgroundColor = '#F2F2F2';
    }
    languageSelect.appendChild(option);
  });

  // retrieve the saved option when the extension loads
  chrome.storage.local.get(['language'], function(result) {
    const selectedLanguage = result.language;
    if (selectedLanguage) {
      languageSelect.value = selectedLanguage;
    } else {
      languageSelect.value = 'Default';
    }
  });

  // save the selected option when the user changes it
  languageSelect.addEventListener('change', function() {
    const selectedOption = languageSelect.value;
    chrome.storage.local.set({ 'language': selectedOption }, function() {});
  });

  row.appendChild(languageProp);
  row.appendChild(languageSelect);

  
  menu.appendChild(row);


  // Create the first summary box
  summaryBox1 = document.createElement('div');
  summaryBox1.className = 'summary-box';
  summaryBox1.style.display = "none";

  const summaryBoxHeader1 = document.createElement('div');
  summaryBoxHeader1.className = 'summary-box__header';

  processingGif.id = "processingPic";
  processingGif.src = chrome.runtime.getURL("images/processingPic.gif");
  summaryBoxHeader1.appendChild(processingGif);

  const preprocessingLabel = document.createElement('p');
  preprocessingLabel.id = 'preprocessingLabel';
  preprocessingLabel.innerHTML = "Reading " + numberOfComments + " comments";
  summaryBoxHeader1.appendChild(preprocessingLabel);

  const toggleButton = document.createElement('button');
  toggleButton.innerHTML = 'Show more';
  toggleButton.classList.add('summary-header-button');

  let contentExpanded = false;
  // Toggle the summaryBoxContent1 element when the summaryBox1 element is clicked, unless the toggle button was clicked
  summaryBox1.addEventListener('click', function (event) {
    if (event.target !== toggleButton && !contentExpanded) {
      summaryBoxContent1.classList.toggle('hidden');
      contentExpanded = true;

      // Update the toggle button text based on the expanded/collapsed state of the box
      if (summaryBoxContent1.classList.contains('hidden')) {
        toggleButton.textContent = 'Show more';
        summaryBox1.classList.remove('expanded');
      } else {
        toggleButton.textContent = 'Show less';
        summaryBox1.classList.add('expanded');
      }
    }
  });

  toggleButton.addEventListener('click', function () {
    if (summaryBoxContent1.classList.contains('hidden')) {
      summaryBoxContent1.classList.remove('hidden');
      contentExpanded = true;
      summaryBox1.classList.add('expanded');
      toggleButton.textContent = 'Show less';
      summaryBox1.appendChild(toggleButton);
      toggleButton.style.marginLeft = '17px';
      toggleButton.style.marginBottom = '10px';
    } else {
      summaryBoxContent1.classList.add('hidden');
      contentExpanded = false;
      summaryBox1.classList.remove('expanded');
      toggleButton.textContent = 'Show more';
      summaryBoxHeader1.appendChild(toggleButton);
      toggleButton.style.marginLeft = '10px';
      toggleButton.style.marginBottom = '0px';
    }
  });

  summaryBoxHeader1.appendChild(toggleButton);

  summaryBoxContent1 = document.createElement('div');
  summaryBoxContent1.className = 'summary-box__content hidden';

  summaryBox1.appendChild(summaryBoxHeader1);
  summaryBox1.appendChild(summaryBoxContent1);

  const separator = document.createElement('hr');
  separator.className = 'main-separator';

  // Create the second summary box
  summaryBox2 = document.createElement('div');
  summaryBox2.className = 'summary-box-2';

  const summaryBoxHeader2 = document.createElement('div');
  summaryBoxHeader2.className = 'summary-box__header';
  const logoPic = document.createElement("img");
  logoPic.id = "logoPic";
  if (isDarkTheme) {
    logoPic.src = chrome.runtime.getURL("images/dark/title.png");
  } else {
    logoPic.src = chrome.runtime.getURL("images/light/title.png");
  }
  
  summaryBoxHeader2.appendChild(navbar);
  summaryBoxHeader2.appendChild(logoPic);
  

  summaryBoxContent2 = document.createElement('div');
  summaryBoxContent2.className = 'summary-box__content';


  const subgroup_container = document.createElement('div');
  subgroup_container.className = 'subgroup_container';

  const subgroup_header_container = document.createElement('div');
  subgroup_header_container.className = 'subgroup_header_container';

  const userProfilePic = document.createElement("img");
  userProfilePic.src = chrome.runtime.getURL("images/userPic.png");

  const summary_header = document.createElement('p');
  summary_header.className = 'pre-summary-text';
  summary_header.innerHTML = 'Summarize all comments';

  subgroup_header_container.appendChild(userProfilePic);
  subgroup_header_container.appendChild(summary_header);

  const subgroup_summary_n_container = document.createElement('div');
  subgroup_summary_n_container.className = 'subgroup_summary_n_container';

  const gptProfilePic = document.createElement("img");
  gptProfilePic.src = chrome.runtime.getURL("images/chatGptPic.png");

  finalSummary = document.createElement('p');
  finalSummary.className = 'summary-text';
  finalSummary.innerHTML = '';

  subgroup_summary_n_container.appendChild(gptProfilePic);
  subgroup_summary_n_container.appendChild(finalSummary);

  subgroup_container.appendChild(subgroup_header_container);
  subgroup_container.appendChild(subgroup_summary_n_container);

  summaryBoxContent2.appendChild(subgroup_container);

  const end_separator1 = document.createElement('hr');
  end_separator1.className = 'main-separator';
  summaryBoxContent2.appendChild(end_separator1);

  summaryBox2.appendChild(summaryBoxHeader2);
  summaryBox2.appendChild(summaryBoxContent2);

  // Add the summary boxes to the page
  container.appendChild(summaryBox1);
  container.appendChild(separator);
  container.appendChild(summaryBox2);
}

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getReadableTimestamp(timestamp) {
  // Parse the timestamp into a Date object
  const dateObject = new Date(timestamp);

  // Get the year, month, day, hour, and minute from the Date object
  const year = dateObject.getFullYear();
  const monthIndex = dateObject.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = monthNames[monthIndex];
  const day = dateObject.getDate();
  const hour = dateObject.getHours();
  const minute = dateObject.getMinutes();

  // Format the timestamp as a string in the desired format
  return `${day} ${month} ${year}`;
}
