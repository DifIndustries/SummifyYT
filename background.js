const cache = new Map();
const KEY_ACCESS_TOKEN = "accessToken";
let abortController;
let aborted = false;

let interval;

let conversationIds = new Map();

function speakLanguage(code) {
  const languages = {
    en: 'Alle prossime domande rispondimi come se io capissi solo l\'inglese. Now wait for my questions:',
    it: 'Alle prossime domande rispondimi come se io capissi solo l\'italiano. Now wait for my questions:',
    fr: 'Alle prossime domande rispondimi come se io capissi solo il francese. Now wait for my questions:',
    de: 'Alle prossime domande rispondimi come se io capissi solo il tedesco. Now wait for my questions:',
    es: 'Alle prossime domande rispondimi come se io capissi solo lo spagnolo. Now wait for my questions:',
    pt: 'Alle prossime domande rispondimi come se io capissi solo il portoghese. Now wait for my questions:',
    ja: 'Alle prossime domande rispondimi come se io capissi solo il giapponese. Now wait for my questions:',
    zh: 'Alle prossime domande rispondimi come se io capissi solo il cinese. Now wait for my questions:',
    ar: 'Alle prossime domande rispondimi come se io capissi solo l\'arabo. Now wait for my questions:',
    ru: 'Alle prossime domande rispondimi come se io capissi solo il russo. Now wait for my questions:',
  };
  return languages[code] || 'Unknown';
}

function speakLanguage2(code) {
  const languages = {
    en: 'english',
    it: 'italian',
    fr: 'french',
    de: 'german',
    es: 'spanish',
    pt: 'portuguese',
    ru: 'russian',
    zh: 'chinese',
    ja: 'japanese',
    ko: 'korean',
    ar: 'arabic',
    hi: 'hindi',
    bn: 'bengali',
    id: 'indonesian',
    ms: 'malay',
    vi: 'vietnamese',
    th: 'thai',
    tr: 'turkish'
  };
  return languages[code] || 'english';
}

// Listen for messages
chrome.runtime.onConnect.addListener((port) => {

  abortController = new AbortController();

  port.onMessage.addListener(async (request, sender, sendResponse) => {

    clearInterval(interval);

    switch(request.type) {
      case "abort":
        aborted = true;
        abortRequest();
        break;
      case "getToken":
        await isAuthorized(port);
        break;
      case "processSingleSummary":
        await processSingleSummary(port, request.content);
        break;
      case "processingBlocks":
        await processBlockOfComments(port, request.content);
        break;
      case "final":
        await generateFinalSummary(port, request.content);
        break;
      default:
        console.log("Received unknown message type:", request.type);
        break;
    }
  });
});

// Function to abort the request
function abortRequest() {
  abortController.abort();
  abortController = new AbortController();
}

async function processBlockOfComments(port, content) {

  let conversationId;

  try {
      
    let detecting = await chrome.i18n.detectLanguage(content);
    let lang = speakLanguage2(detecting.languages[0].language)

    try {
      let result = await readLocalStorage('language');
      // Use the result
      if (result !== undefined && result !== 'Default') {
        lang = result;
      }
    } catch (error) {
      // key not found
    }

    let prompt = "Summarize in " + lang + " the main takeaways from these comments below the video, including any notable trends or patterns:";

    const gptQuestion = prompt + `\n\n${content}`;
    let parentMessageId;

    // await setConversationLanguage(speakLanguage(detecting.languages[0].language), (answer) => {
    //   conversationId = answer.conversation_id;
    //   parentMessageId = answer.message.id;
    // });

    aborted = false;

    await getSummary(gptQuestion, (answer) => {
      conversationId = answer.conversation_id;
      if (!(conversationIds.has(answer.conversation_id))) {
        conversationIds.set(answer.conversation_id, true);
      }

      const text = answer.message?.content?.parts?.[0];
      if (!text.startsWith("Summarize")) {
        port.postMessage({ text });
      }
      
    });

    await deleteConversation(conversationId);

    port.postMessage({ end: "end" });

  } catch (err) {
    if (!aborted) {
      port.postMessage({ error: err.message, end: "end" });
      cache.delete(KEY_ACCESS_TOKEN);
    } else {
      // Set up the interval to delete all conversations after 5 seconds
      const intervalMilliseconds = 5000; // convert to milliseconds
      interval = setInterval(deleteConversations, intervalMilliseconds);
    }
  }
}

const readLocalStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        reject();
      } else {
        resolve(result[key]);
      }
    });
  });
};

async function processSingleSummary(port, content) {

  try {
    
    let detecting = await chrome.i18n.detectLanguage(content);
    let lang = speakLanguage2(detecting.languages[0].language)

    let conversationId;

    try {
      let result = await readLocalStorage('language');
      // Use the result
      if (result !== undefined && result !== 'Default') {
        lang = result;
      }
    } catch (error) {
      // key not found
    }

    let prompt = "Please provide an overall summary in " + lang + " of the main takeaways and notable trends or patterns discussed in the comments below the video:";
    const gptQuestion = prompt + `\n\n${content}`;
    let parentMessageId;

    // await setConversationLanguage(speakLanguage(detecting.languages[0].language), (answer) => {
    //   conversationId = answer.conversation_id;
    //   parentMessageId = answer.message.id;
    // });

    await getSummary(gptQuestion, (answer) => {
      conversationId = answer.conversation_id;
      if (!(conversationIds.has(answer.conversation_id))) {
        conversationIds.set(answer.conversation_id, true);
      }

      const text = answer.message?.content?.parts?.[0];
      if (!text.startsWith("Please provide")) {
        port.postMessage({ text });
      }
    });

    await deleteConversation(conversationId);
    // Set up the interval to delete all conversations after 5 seconds
    const intervalMilliseconds = 5000; // convert to milliseconds
    interval = setInterval(deleteConversations, intervalMilliseconds);

  } catch (err) {
    if (!aborted) {
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    } else {
      // Set up the interval to delete all conversations after 5 seconds
      const intervalMilliseconds = 5000; // convert to milliseconds
      interval = setInterval(deleteConversations, intervalMilliseconds);
    }
  }
}

async function generateFinalSummary(port, content) {
  try {
      
    let detecting = await chrome.i18n.detectLanguage(content);
    let lang = speakLanguage2(detecting.languages[0].language)

    let conversationId;

    try {
      let result = await readLocalStorage('language');
      // Use the result
      if (result !== undefined && result !== 'Default') {
        lang = result;
      }
    } catch (error) {
      // key not found
    }

    let prompt = "Please provide an overall summary in " + lang + " of the main takeaways and notable trends or patterns discussed in the summaries of the comments below the video:";

    const gptQuestion = prompt + `\n\n${content}`;
    let parentMessageId;

    // await setConversationLanguage(speakLanguage(detecting.languages[0].language), (answer) => {
    //   conversationId = answer.conversation_id;
    //   parentMessageId = answer.message.id;
    // });

    await getSummary(gptQuestion, (answer) => {
      conversationId = answer.conversation_id;
      if (!(conversationIds.has(answer.conversation_id))) {
        conversationIds.set(answer.conversation_id, true);
      }
      
      const text = answer.message?.content?.parts?.[0];
      if (!text.startsWith("Please provide")) {
        port.postMessage({ text });
      }
    });

    await deleteConversation(conversationId);
    // Set up the interval to delete all conversations after 5 seconds
    const intervalMilliseconds = 5000; // convert to milliseconds
    interval = setInterval(deleteConversations, intervalMilliseconds);

  } catch (err) {
    if (!aborted) {
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    } else {
      // Set up the interval to delete all conversations after 5 seconds
      const intervalMilliseconds = 5000; // convert to milliseconds
      interval = setInterval(deleteConversations, intervalMilliseconds);
    }
    
  }
}

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const resp = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!resp.accessToken) {
    throw new Error("UNAUTHORIZED");
  }
  cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  return resp.accessToken;
}

async function isAuthorized(port) {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    port.postMessage({ text: "AUTHORIZED" });
    return;
  }
  const resp = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!resp.accessToken) {
    port.postMessage({ error: "UNAUTHORIZED" });
  } else {
    port.postMessage({ text: "AUTHORIZED" });
    cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  }
  
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function setConversationLanguage(question, callback) {
    const accessToken = await getAccessToken();
    await fetchSSE("https://chat.openai.com/backend-api/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "next",
        messages: [
          {
            id: uuidv4(),
            role: "user",
            content: {
              content_type: "text",
              parts: [question],
            },
          },
        ],
        model: "text-davinci-002-render",
        parent_message_id: uuidv4(),
      }),
      onMessage(message) {
        console.debug("sse message", message);
        if (message === "[DONE]") {
          return;
        }
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch {
          console.log("json parse error");
        }
        
      },
    });
}


async function deleteConversations() {
  console.log("checking map__________________________________-");
  if (conversationIds.size === 0) {
    clearInterval(interval);
    return;
  }
  for (const [key, value] of conversationIds) {
    const accessToken = await getAccessToken();

    await fetch("https://chat.openai.com/backend-api/conversation/" + key, {
      method: "GET",
      headers: {
         Authorization: `Bearer ${accessToken}`,
      }
    })
    .then(response => {
      if (response.ok) {
        deleteConversation(key);
      } else if (response.status === 404) {
        conversationIds.delete(key);
      } else {
        throw new Error("Error fetching conversation");
      }
    }).catch(error => {
      // Handle fetch errors
      console.error("error: " + error);
    });
  }
}

async function deleteConversation(conversation_id) {
  const accessToken = await getAccessToken();
  await fetch("https://chat.openai.com/backend-api/conversation/" + conversation_id, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      is_visible: false,
    }),
  });
}

async function getSummary(question, callback) {

    const accessToken = await getAccessToken();
    await fetchSSE("https://chat.openai.com/backend-api/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "next",
        messages: [
          {
            id: uuidv4(),
            role: "user",
            content: {
              content_type: "text",
              parts: [question],
            },
          },
        ],
        model: "text-davinci-002-render",
        parent_message_id: uuidv4(),
      }),
      onMessage(message) {
        console.log("fetched");
        console.debug("sse message", message);
        if (message === "[DONE]") {
          return;
        }
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch {
          console.log("Json parse error");
        }
        
      },
    });
}

async function fetchSSE(resource, options) {
  const { onMessage, ...fetchOptions } = options;
  const resp = await fetch(resource, { ...fetchOptions, signal: abortController.signal });
  if (resp.ok) {
    console.log("Fetch successful!");
  } else {
    const text = await resp.text();
    const json = JSON.parse(text);
    console.log("Fetch failed with status code: " + resp.status);
    throw new Error(json.detail);
  }
  const parser = createParser((event) => {
    if (event.type === "event") {
      onMessage(event.data);
    }
  });
  for await (const chunk of streamAsyncIterable(resp.body)) {
    const str = new TextDecoder().decode(chunk);
    parser.feed(str);
  }
}

async function* streamAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Creates a new EventSource parser.
 *
 * @param onParse - Callback to invoke when a new event is parsed, or a new reconnection interval
 *                  has been sent from the server
 *
 * @returns A new EventSource parser, with `parse` and `reset` methods.
 * @public
 */
function createParser(onParse) {
  // Processing state
  let isFirstChunk;
  let buffer;
  let startingPosition;
  let startingFieldLength;
  // Event state
  let eventId;
  let eventName;
  let data;
  reset();
  return { feed, reset };
  function reset() {
    isFirstChunk = true;
    buffer = '';
    startingPosition = 0;
    startingFieldLength = -1;
    eventId = undefined;
    eventName = undefined;
    data = '';
  }
  function feed(chunk) {
    buffer = buffer ? buffer + chunk : chunk;
    // Strip any UTF8 byte order mark (BOM) at the start of the stream.
    // Note that we do not strip any non - UTF8 BOM, as eventsource streams are
    // always decoded as UTF8 as per the specification.
    if (isFirstChunk && hasBom(buffer)) {
      buffer = buffer.slice(BOM.length);
    }
    isFirstChunk = false;
    // Set up chunk-specific processing state
    const length = buffer.length;
    let position = 0;
    let discardTrailingNewline = false;
    // Read the current buffer byte by byte
    while (position < length) {
      // EventSource allows for carriage return + line feed, which means we
      // need to ignore a linefeed character if the previous character was a
      // carriage return
      // @todo refactor to reduce nesting, consider checking previous byte?
      // @todo but consider multiple chunks etc
      if (discardTrailingNewline) {
        if (buffer[position] === '\n') {
          ++position;
        }
        discardTrailingNewline = false;
      }
      let lineLength = -1;
      let fieldLength = startingFieldLength;
      let character;
      for (let index = startingPosition; lineLength < 0 && index < length; ++index) {
        character = buffer[index];
        if (character === ':' && fieldLength < 0) {
          fieldLength = index - position;
        }
        else if (character === '\r') {
          discardTrailingNewline = true;
          lineLength = index - position;
        }
        else if (character === '\n') {
          lineLength = index - position;
        }
      }
      if (lineLength < 0) {
        startingPosition = length - position;
        startingFieldLength = fieldLength;
        break;
      }
      else {
        startingPosition = 0;
        startingFieldLength = -1;
      }
      parseEventStreamLine(buffer, position, fieldLength, lineLength);
      position += lineLength + 1;
    }
    if (position === length) {
      // If we consumed the entire buffer to read the event, reset the buffer
      buffer = '';
    }
    else if (position > 0) {
      // If there are bytes left to process, set the buffer to the unprocessed
      // portion of the buffer only
      buffer = buffer.slice(position);
    }
  }
  function parseEventStreamLine(lineBuffer, index, fieldLength, lineLength) {
    if (lineLength === 0) {
      // We reached the last line of this event
      if (data.length > 0) {
        onParse({
          type: 'event',
          id: eventId,
          event: eventName || undefined,
          data: data.slice(0, -1), // remove trailing newline
        });
        data = '';
        eventId = undefined;
      }
      eventName = undefined;
      return;
    }
    const noValue = fieldLength < 0;
    const field = lineBuffer.slice(index, index + (noValue ? lineLength : fieldLength));
    let step = 0;
    if (noValue) {
      step = lineLength;
    }
    else if (lineBuffer[index + fieldLength + 1] === ' ') {
      step = fieldLength + 2;
    }
    else {
      step = fieldLength + 1;
    }
    const position = index + step;
    const valueLength = lineLength - step;
    const value = lineBuffer.slice(position, position + valueLength).toString();
    if (field === 'data') {
      data += value ? `${value}\n` : '\n';
    }
    else if (field === 'event') {
      eventName = value;
    }
    else if (field === 'id' && !value.includes('\u0000')) {
      eventId = value;
    }
    else if (field === 'retry') {
      const retry = parseInt(value, 10);
      if (!Number.isNaN(retry)) {
        onParse({ type: 'reconnect-interval', value: retry });
      }
    }
  }
}

const BOM = [239, 187, 191];
function hasBom(buffer) {
    return BOM.every((charCode, index) => buffer.charCodeAt(index) === charCode);
}

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}