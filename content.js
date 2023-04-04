// Get the root element
const root = document.documentElement;

// Define the CSS variables
const lightTheme = {
  subgroupHeaderBackground: '#FFFFFF',
  subgroupSummaryBackground: '#F7F7F8',
  menuRowBackgroundColor: '#fefefe',
  overlayColor: 'rgba(255, 255, 255, 0.5)',
  subgroupSummaryShadow: 'rgba(0, 0, 0, 0.1) -2px -2px 8px'
};

const darkTheme = {
  subgroupHeaderBackground: '#343541',
  subgroupSummaryBackground: '#444654',
  menuRowBackgroundColor: '#181818',
  overlayColor: 'rgba(0, 0, 0, 0.5)',
  subgroupSummaryShadow: 'rgba(255, 255, 255, 0.1) -2px -2px 8px'
};

// Detect the current theme setting
const isDarkTheme = root.getAttribute('dark') !== null;

// Set the CSS variables based on the current theme setting
if (isDarkTheme) {
  root.style.setProperty('--subgroup-header-container-backgroundcolor', darkTheme.subgroupHeaderBackground);
  root.style.setProperty('--subgroup-summary-container-backgroundcolor', darkTheme.subgroupSummaryBackground);
  root.style.setProperty('--menu-row-backgroundcolor', darkTheme.menuRowBackgroundColor);
  root.style.setProperty('--overlay-backgroundcolor', darkTheme.overlayColor);
  root.style.setProperty('--subgroup-summary-shadow', darkTheme.subgroupSummaryShadow);
} else {
  root.style.setProperty('--subgroup-header-container-backgroundcolor', lightTheme.subgroupHeaderBackground);
  root.style.setProperty('--subgroup-summary-container-backgroundcolor', lightTheme.subgroupSummaryBackground);
  root.style.setProperty('--menu-row-backgroundcolor', lightTheme.menuRowBackgroundColor);
  root.style.setProperty('--overlay-backgroundcolor', lightTheme.overlayColor);
  root.style.setProperty('--subgroup-summary-shadow', lightTheme.subgroupSummaryShadow);
}

const API_KEY = 'YOUR API KEY';

let MAX_RESULTS = 100;
let pageToken;
let numberOfComments;

async function getComments() {
  let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&key=${API_KEY}&maxResults=${MAX_RESULTS}`;
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

async function getReplies(parentId) { 
  let url = `https://www.googleapis.com/youtube/v3/comments?part=snippet&parentId=${parentId}&key=${API_KEY}&maxResults=${MAX_RESULTS}`;
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
  const comments = [];
  let previousTimestamp = null;

  if (!(numberOfComments > 0)) {
    return [];
  }

  const all_comments = [];

  while (true) {
    const ytbData = await getComments();

    if (!ytbData.items) {
      break;
    }

    for (const comment of ytbData.items) {
      all_comments.push(comment.snippet.topLevelComment); // Push the top level comment

      if (comment.snippet.totalReplyCount > 5) { // Check if there are more than five replies
        const repliesData = await getReplies(comment.id); // Call the comments.list method to get all replies
        
        for (const reply of repliesData.items) { // Loop through the replies
          all_comments.push(reply); // Push each reply
        }

      } else if (comment.replies) { // Check if there are any replies
        
        for (const reply of comment.replies.comments) { // Loop through the replies
          all_comments.push(reply); // Push each reply
        }
      }
      
    }

    if (ytbData.nextPageToken) {
      pageToken = ytbData.nextPageToken;
    } else {
      break;
    }
  }

   // Reverse the array to get comments from oldest to newest
  all_comments.reverse();

  for (const comment of all_comments) {
    const currentTimestamp = comment.snippet.publishedAt;

    // Check if previousTimestamp is not null and if the current timestamp is less than the previous timestamp
    if (comment.snippet.parentId !== undefined ||
      new Date(currentTimestamp) >= new Date(previousTimestamp)) {
    comments.push({
        text: comment.snippet.textOriginal,
        timestamp: comment.snippet.publishedAt
      });
    } else {
      console.log(previousTimestamp);
      console.log(currentTimestamp);
    }

    if (comment.snippet.parentId === undefined) {
      previousTimestamp = currentTimestamp;
    }
  }

  // Concatenate comments into chunks not greater than 13000 characters
  let commentChunks = [];
  let currentChunk = "";
  let currentChunkTimestamps = {
    first: null,
    last: null,
    count: 0
  };
  let chunkTimestamps = [];

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i].text;
    const timestamp = comments[i].timestamp;

    if (currentChunk.length + comment.length + 1 <= 13000) {
      currentChunk += comment + "\n";

      if (!currentChunkTimestamps.first) {
        currentChunkTimestamps.first = timestamp;
      }
      currentChunkTimestamps.last = timestamp;
      currentChunkTimestamps.count++;
    } else {
      commentChunks.push(currentChunk);
      chunkTimestamps.push({ ...currentChunkTimestamps });
      currentChunk = comment + "\n";
      currentChunkTimestamps.first = null;
      currentChunkTimestamps.last = null;
      currentChunkTimestamps.count = 1;
    }
  }

  if (currentChunk) {
    commentChunks.push(currentChunk);
    chunkTimestamps.push({ ...currentChunkTimestamps });
  }

  return { content: commentChunks, timestamps: chunkTimestamps };
}


let content;
let timestamps;

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
        createSvgFilter();
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

    // Check the auto-start setting before starting the summarization
    chrome.storage.local.get(['autoStart'], function (result) {
      // If autoStart is not found in local storage, the default value will be true
      const autoStart = result.autoStart ?? true;
      const startOverlay = document.getElementById('start-overlay');
      if (startOverlay) {
        startOverlay.style.display = autoStart ? 'none' : 'block'; // Show the overlay if autoStart is disabled
      }
      if (autoStart) {
        checkAuth();
      }
    });

  }
}

async function checkAuth() {
  port.postMessage({ type: "getToken" });
}

async function waitForLogin() {

  if (checkLoginInterval) {
    clearInterval(checkLoginInterval);
  }
  checkLoginInterval = setInterval(checkAuth, 4000);

  finalSummary.innerHTML =
    'Please login at <a href="https://chat.openai.com" target="_blank">chat.openai.com</a>';

}

async function start() {

  if (checkLoginInterval) {
    clearInterval(checkLoginInterval);
  }

  finalSummary.innerHTML = "Please wait while your comments are being processed. This may take a few moments, but it will ensure the best possible results for your summaries.";

  if (content.length > 1) {
    summaryBox1.style.display = "block";
    processNextSummary();
  } else {
    summaryBox1.style.display = "none";
    processSingleSummary();
  }
}

function processSingleSummary() {

  if (content.length < 2) {

    buffer = finalSummary;
    const rawComments = content.shift();
    port.postMessage({ type: "processSingleSummary", rawComments });

  }
}

async function processNextSummary() {
  if (content.length > 0) {

    const subgroup_container = document.createElement('div');
    subgroup_container.className = 'subgroup_container';

    const summary_header = document.createElement('div');
    summary_header.className = 'chunk-header';

    const subgroup_summary_n_container = document.createElement('div');
    subgroup_summary_n_container.className = 'subgroup_summary_n_container';

    const summary1 = document.createElement('p');
    summary1.className = 'summary-text';

    subgroup_summary_n_container.appendChild(summary_header);
    subgroup_summary_n_container.appendChild(summary1);

    subgroup_container.appendChild(subgroup_summary_n_container);

    summaryBoxContent1.appendChild(subgroup_container);

    const commentsInterval = timestamps.shift();

    summary_header.innerHTML = '<mark>' + commentsInterval.count + ' comments</mark> <span><mark>from ' + getReadableTimestamp(commentsInterval.first) + ' to ' + getReadableTimestamp(commentsInterval.last) + '</mark></span>';
    buffer = summary1;
    const rawComments = content.shift();

    port.postMessage({ type: "processingBlocks", rawComments });

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
        buffer.innerHTML = msg.error;
        buffer.style.color = '#EF4444';
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
  const final_summary_header = document.getElementById("final-summary-header");
  // Toggle the innerHTML of final_summary_header.
  if (final_summary_header.innerHTML == 'Settings') {
    final_summary_header.innerHTML = 'Summary of comments';
  } else {
    final_summary_header.innerHTML = 'Settings';
  }
}

function createHTML() {

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
      toggleButton.style.marginLeft = '0px';
      toggleButton.style.marginBottom = '0px';
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

  summaryBoxContent2 = document.createElement('div');
  summaryBoxContent2.className = 'summary-box__content';

  const summaryBoxHeader2 = document.createElement('div');
  summaryBoxHeader2.className = 'summary-box__header';

  const summary_header = document.createElement('p');
  summary_header.id = 'final-summary-header';
  summary_header.className = 'pre-summary-text';
  summary_header.innerHTML = 'Summary of comments';

  finalSummary = document.createElement('p');
  finalSummary.className = 'summary-text';
  finalSummary.innerHTML = '';

  summaryBoxContent2.appendChild(finalSummary);

  summaryBox2.appendChild(summaryBoxHeader2);
  summaryBox2.appendChild(summaryBoxContent2);

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
    menu.style.background = 'rgba(39, 39, 39, 0.95)';
  } else {
    menu.style.background = 'rgba(242, 242, 242, 0.95)';
  }

  const row = document.createElement('div');
  row.className = 'menu-row';
  menu.appendChild(row);

  // Create a label element for the combobox
  const languageProp = document.createElement('div');

  const languageLabel = document.createElement('p');
  languageLabel.className = 'language-label';
  languageLabel.textContent = 'Summary language';
  languageProp.appendChild(languageLabel);

  const languageDescription = document.createElement('p');
  languageDescription.className = 'setting-description';
  languageDescription.textContent = 'The summary language is the language that will be used to summarize the comments. When set to \'Default\',  the most common language in the comments will be used.';
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


  const row_autostart = document.createElement('div');
  row_autostart.className = 'menu-row';
  menu.appendChild(row_autostart);

  // Create a toggle button for auto-starting the summary
  const autoStartToggleContainer = document.createElement('div');
  const autoStartLabel = document.createElement('p');
  autoStartLabel.className = 'language-label';
  autoStartLabel.textContent = 'Auto-start summary';
  autoStartToggleContainer.appendChild(autoStartLabel);

  const autoStartDescription = document.createElement('p');
  autoStartDescription.className = 'setting-description';
  autoStartDescription.textContent = 'Enable this setting to automatically start the summarization process when the page loads.';
  autoStartToggleContainer.appendChild(autoStartDescription);

  const autoStartToggle = document.createElement('label');
  autoStartToggle.classList.add('switch');

  const autoStartCheckbox = document.createElement('input');
  autoStartCheckbox.type = 'checkbox';
  autoStartToggle.appendChild(autoStartCheckbox);

  const autoStartSlider = document.createElement('span');
  autoStartSlider.classList.add('slider', 'round');
  autoStartToggle.appendChild(autoStartSlider);

  // retrieve the saved auto-start option when the extension loads
  chrome.storage.local.get(['autoStart'], function(result) {
    // If autoStart is not found in local storage, the default value will be true
    autoStartCheckbox.checked = result.autoStart ?? true;
  });

  // save the auto-start option when the user changes it
  autoStartCheckbox.addEventListener('change', function() {
    chrome.storage.local.set({ 'autoStart': autoStartCheckbox.checked }, function() {});
  });

  row_autostart.appendChild(autoStartToggleContainer);
  row_autostart.appendChild(autoStartToggle);

  navbar.appendChild(menu);

  summaryBoxHeader2.appendChild(navbar);
  summaryBoxHeader2.appendChild(summary_header);

  // Create a semi-transparent overlay for the summaryBox2
  const startOverlay = document.createElement('div');
  startOverlay.id = 'start-overlay';
  startOverlay.addEventListener('click', function() {
    checkAuth();
    this.style.display = 'none'; // Hide the overlay when clicked
  });

  // Create the app logo
  const appLogo = document.createElement('img');
  appLogo.src = chrome.runtime.getURL("images/logo64.png");
  appLogo.style.position = 'absolute';
  appLogo.style.top = '35%'; // Move the logo 60px above the vertical center
  appLogo.style.left = '50%';
  appLogo.style.transform = 'translate(-50%, -50%)';
  appLogo.style.filter = 'url(#outlineFilter)';

  // Create a message to indicate this area is clickable
  const clickMessage = document.createElement('div');
  clickMessage.id = 'click-message';
  clickMessage.innerHTML = 'Click to summarize comments';

  startOverlay.appendChild(appLogo);
  startOverlay.appendChild(clickMessage);
  summaryBox2.style.position = 'relative';
  summaryBox2.appendChild(startOverlay);

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
  return `${day} ${month} ${year}, ${hour}:${minute.toString().padStart(2, '0')}`;
}

function createSvgFilter() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';

  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', 'outlineFilter');

  const feMorphology = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
  feMorphology.setAttribute('in', 'SourceAlpha');
  feMorphology.setAttribute('operator', 'dilate');
  feMorphology.setAttribute('radius', '0.5');
  feMorphology.setAttribute('result', 'dilatedAlpha');

  const feColorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
  feColorMatrix.setAttribute('type', 'matrix');
  feColorMatrix.setAttribute('values', '1 0 0 0 1 0 1 0 0 1 0 0 1 0 1 0 0 0 1 0');
  feColorMatrix.setAttribute('result', 'mask');

  const feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
  feComposite.setAttribute('in', 'mask');
  feComposite.setAttribute('in2', 'SourceGraphic');
  feComposite.setAttribute('operator', 'in');
  feComposite.setAttribute('result', 'mask2');

  const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  feMergeNode1.setAttribute('in', 'mask2');
  const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  feMergeNode2.setAttribute('in', 'SourceGraphic');

  feMerge.appendChild(feMergeNode1);
  feMerge.appendChild(feMergeNode2);

  filter.appendChild(feMorphology);
  filter.appendChild(feColorMatrix);
  filter.appendChild(feComposite);
  filter.appendChild(feMerge);

  svg.appendChild(filter);

  // Append the created SVG filter to the body element
  document.body.appendChild(svg);
}
