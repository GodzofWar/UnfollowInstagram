// ── Tab switching ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel).classList.add('active');
  });
});

// ── Shared helpers ──
let activeTabId = null;
let whitelist = new Set();

function getInstagramTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
      callback(null);
    } else {
      callback(tab);
    }
  });
}

function setStatus(el, text, type) {
  el.textContent = text;
  el.className = 'status' + (type ? ' ' + type : '');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Progress bar helpers ──
function showProgress(wrapId, fillId, textId, text, percent) {
  const wrap = document.getElementById(wrapId);
  const fill = document.getElementById(fillId);
  const textEl = document.getElementById(textId);
  wrap.style.display = 'block';
  textEl.textContent = text;
  if (percent === null) {
    // Indeterminate
    fill.className = 'progress-fill indeterminate';
    fill.style.width = '30%';
  } else {
    fill.className = 'progress-fill';
    fill.style.width = Math.min(100, percent) + '%';
  }
}

function hideProgress(wrapId) {
  document.getElementById(wrapId).style.display = 'none';
}

// ── Whitelist ──
function loadWhitelist(callback) {
  chrome.storage.local.get({ whitelist: [] }, (data) => {
    whitelist = new Set(data.whitelist);
    if (callback) callback();
  });
}

function saveWhitelist() {
  chrome.storage.local.set({ whitelist: [...whitelist] });
}

function renderWhitelist() {
  const listEl = document.getElementById('whitelist-list');
  const countEl = document.getElementById('whitelist-count');
  listEl.innerHTML = '';

  const sorted = [...whitelist].sort();
  for (const username of sorted) {
    const item = document.createElement('div');
    item.className = 'whitelist-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'username';
    nameSpan.textContent = username;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => {
      whitelist.delete(username);
      saveWhitelist();
      renderWhitelist();
    });

    item.appendChild(nameSpan);
    item.appendChild(removeBtn);
    listEl.appendChild(item);
  }

  countEl.textContent = whitelist.size > 0
    ? whitelist.size + ' protected account' + (whitelist.size !== 1 ? 's' : '')
    : 'No protected accounts';
}

const whitelistInput = document.getElementById('whitelist-input');
const whitelistAddBtn = document.getElementById('whitelist-add-btn');

function addToWhitelist() {
  const username = whitelistInput.value.trim().replace(/^@/, '');
  if (!username) return;
  whitelist.add(username);
  saveWhitelist();
  renderWhitelist();
  whitelistInput.value = '';
}

whitelistAddBtn.addEventListener('click', addToWhitelist);
whitelistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addToWhitelist();
});

// Load whitelist on popup open
loadWhitelist(() => renderWhitelist());

// ── Mass Unfollow Panel ──
const massStatus = document.getElementById('mass-status');
const massCount = document.getElementById('mass-count');
const massDelay = document.getElementById('mass-delay');
const massLimit = document.getElementById('mass-limit');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

function setMassRunning(running) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  massDelay.disabled = running;
  massLimit.disabled = running;
  if (running) setStatus(massStatus, 'Unfollowing...', 'running');
}

chrome.runtime.onMessage.addListener((message) => {
  // Mass unfollow messages
  if (message.type === 'unfollow-count') {
    massCount.textContent = message.count;
    showProgress('mass-progress', 'mass-progress-fill', 'mass-progress-text',
      'Unfollowed ' + message.count + (message.skipped ? ' (' + message.skipped + ' whitelisted skipped)' : ''), null);
  } else if (message.type === 'unfollow-done') {
    massCount.textContent = message.count;
    setMassRunning(false);
    hideProgress('mass-progress');
    const limitVal = parseInt(massLimit.value, 10);
    const hitLimit = limitVal > 0 && message.count >= limitVal;
    setStatus(massStatus, 'Done! Unfollowed ' + message.count + ' accounts.' +
      (hitLimit ? ' (limit reached)' : ''));
  } else if (message.type === 'unfollow-error') {
    setMassRunning(false);
    hideProgress('mass-progress');
    setStatus(massStatus, message.error, 'error');
  }
  // Selective unfollow messages
  else if (message.type === 'selective-count') {
    selectCountEl.textContent = message.count;
    const pct = Math.round((message.count / message.total) * 100);
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text',
      message.count + ' / ' + message.total + ' unfollowed', pct);
  } else if (message.type === 'selective-done') {
    selectCountEl.textContent = message.count;
    setSelectRunning(false);
    hideProgress('select-progress');
    setStatus(selectStatus, 'Done! Unfollowed ' + message.count + ' of ' + message.total + ' selected.');
  } else if (message.type === 'selective-error') {
    setSelectRunning(false);
    hideProgress('select-progress');
    setStatus(selectStatus, message.error, 'error');
  }
  // Scrape progress messages
  else if (message.type === 'scrape-progress') {
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text',
      message.text, message.percent);
  }
});

startBtn.addEventListener('click', () => {
  const delay = parseInt(massDelay.value, 10);
  const limit = parseInt(massLimit.value, 10);
  getInstagramTab((tab) => {
    if (!tab) return setStatus(massStatus, 'Open Instagram first!', 'error');
    activeTabId = tab.id;
    setMassRunning(true);
    massCount.textContent = '0';
    showProgress('mass-progress', 'mass-progress-fill', 'mass-progress-text', 'Starting...', null);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: massUnfollow,
      args: [delay, [...whitelist], limit]
    });
  });
});

stopBtn.addEventListener('click', () => {
  if (activeTabId !== null) {
    chrome.tabs.sendMessage(activeTabId, { type: 'stop-unfollow' });
    setMassRunning(false);
    hideProgress('mass-progress');
    setStatus(massStatus, 'Stopped.');
  }
});

// ── Select Profiles Panel ──
const selectStatus = document.getElementById('select-status');
const loadBtn = document.getElementById('load-profiles');
const loadLeastBtn = document.getElementById('load-least-interacted');
const loadNonFollowersBtn = document.getElementById('load-non-followers');
const searchInput = document.getElementById('search');
const selectAllCheckbox = document.getElementById('select-all');
const profileListEl = document.getElementById('profile-list');
const selectedCountEl = document.getElementById('selected-count');
const unfollowSelectedBtn = document.getElementById('unfollow-selected');
const stopSelectedBtn = document.getElementById('stop-selected');
const selectCountEl = document.getElementById('select-count');
const selectDelay = document.getElementById('select-delay');
const selectLimit = document.getElementById('select-limit');
const exportBtn = document.getElementById('export-csv');

let profiles = []; // { username, displayName, selected }

function renderProfiles(filter) {
  const query = (filter || '').toLowerCase();
  profileListEl.innerHTML = '';

  const filtered = profiles.filter(p =>
    p.username.toLowerCase().includes(query) ||
    (p.displayName && p.displayName.toLowerCase().includes(query))
  );

  if (filtered.length === 0 && profiles.length > 0) {
    profileListEl.innerHTML = '<div class="empty-msg">No matches</div>';
    return;
  }

  for (const p of filtered) {
    const isWhitelisted = whitelist.has(p.username);
    const item = document.createElement('div');
    item.className = 'profile-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!p.selected;
    cb.disabled = isWhitelisted;
    cb.addEventListener('change', () => {
      p.selected = cb.checked;
      updateSelectedCount();
    });

    const label = document.createElement('span');
    label.innerHTML = '<span class="username">' + escapeHtml(p.username) + '</span>' +
      (p.displayName ? '<span class="display-name">' + escapeHtml(p.displayName) + '</span>' : '');

    item.appendChild(cb);
    item.appendChild(label);

    if (isWhitelisted) {
      const badge = document.createElement('span');
      badge.className = 'whitelist-badge';
      badge.textContent = 'protected';
      item.appendChild(badge);
      item.style.opacity = '0.5';
    } else {
      const protectBtn = document.createElement('button');
      protectBtn.className = 'protect-btn';
      protectBtn.textContent = '\u{1F6E1}';
      protectBtn.title = 'Add to whitelist';
      protectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        whitelist.add(p.username);
        p.selected = false;
        saveWhitelist();
        renderWhitelist();
        renderProfiles(searchInput.value);
        updateSelectedCount();
      });
      item.appendChild(protectBtn);

      item.addEventListener('click', (e) => {
        if (e.target === cb || e.target === protectBtn) return;
        cb.checked = !cb.checked;
        p.selected = cb.checked;
        updateSelectedCount();
      });
    }

    profileListEl.appendChild(item);
  }
}

function updateSelectedCount() {
  const selectable = profiles.filter(p => !whitelist.has(p.username));
  const count = selectable.filter(p => p.selected).length;
  const wlCount = profiles.length - selectable.length;
  let text = count + ' of ' + selectable.length + ' selected';
  if (wlCount > 0) text += ' (' + wlCount + ' protected)';
  selectedCountEl.textContent = text;
  unfollowSelectedBtn.disabled = count === 0;
  selectAllCheckbox.checked = count === selectable.length && selectable.length > 0;
  selectAllCheckbox.indeterminate = count > 0 && count < selectable.length;
}

function showSelectUI(show) {
  const display = show ? '' : 'none';
  document.getElementById('select-toolbar').style.display = show ? 'flex' : 'none';
  document.getElementById('select-all-container').style.display = display;
  selectedCountEl.style.display = display;
  document.getElementById('export-row').style.display = display;
  document.getElementById('select-buttons').style.display = show ? 'flex' : 'none';
  document.getElementById('select-delay-setting').style.display = display;
  document.getElementById('select-limit-setting').style.display = display;
  selectCountEl.style.display = display;
  document.getElementById('select-count-label').style.display = display;
}

searchInput.addEventListener('input', () => {
  renderProfiles(searchInput.value);
});

selectAllCheckbox.addEventListener('change', () => {
  const query = (searchInput.value || '').toLowerCase();
  const checked = selectAllCheckbox.checked;
  for (const p of profiles) {
    if (whitelist.has(p.username)) continue;
    if (!query || p.username.toLowerCase().includes(query) ||
        (p.displayName && p.displayName.toLowerCase().includes(query))) {
      p.selected = checked;
    }
  }
  renderProfiles(searchInput.value);
  updateSelectedCount();
});

function setAllLoadButtons(disabled) {
  loadBtn.disabled = disabled;
  loadLeastBtn.disabled = disabled;
  loadNonFollowersBtn.disabled = disabled;
}

function handleScrapeResults(results, label) {
  setAllLoadButtons(false);
  hideProgress('select-progress');
  if (!results || !results[0] || !results[0].result) {
    setStatus(selectStatus, 'Could not load profiles. Make sure the following list is open.', 'error');
    return;
  }
  const scraped = results[0].result;
  if (scraped.length === 0) {
    setStatus(selectStatus, 'No profiles found. Open your following list first.', 'error');
    return;
  }

  const existing = new Map(profiles.map(p => [p.username, p.selected]));
  profiles = scraped.map(p => ({
    ...p,
    selected: existing.has(p.username) ? existing.get(p.username) : false
  }));

  setStatus(selectStatus, 'Loaded ' + profiles.length + ' ' + label + '.');
  showSelectUI(true);
  renderProfiles(searchInput.value);
  updateSelectedCount();
}

loadBtn.addEventListener('click', () => {
  getInstagramTab((tab) => {
    if (!tab) return setStatus(selectStatus, 'Open Instagram first!', 'error');
    setStatus(selectStatus, 'Scrolling to load profiles...', 'running');
    setAllLoadButtons(true);
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text', 'Loading...', null);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeProfiles
    }, (results) => handleScrapeResults(results, 'profiles'));
  });
});

loadLeastBtn.addEventListener('click', () => {
  getInstagramTab((tab) => {
    if (!tab) return setStatus(selectStatus, 'Open Instagram first!', 'error');
    setStatus(selectStatus, 'Loading least interacted profiles...', 'running');
    setAllLoadButtons(true);
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text', 'Finding category...', null);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeLeastInteracted
    }, (results) => handleScrapeResults(results, 'least interacted profiles'));
  });
});

loadNonFollowersBtn.addEventListener('click', () => {
  getInstagramTab((tab) => {
    if (!tab) return setStatus(selectStatus, 'Open Instagram first!', 'error');
    setStatus(selectStatus, 'Scanning followers & following lists...', 'running');
    setAllLoadButtons(true);
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text', 'Opening followers...', null);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeNonFollowers
    }, (results) => {
      setAllLoadButtons(false);
      hideProgress('select-progress');
      if (!results || !results[0] || !results[0].result) {
        setStatus(selectStatus, 'Failed. Make sure you are on your own profile page.', 'error');
        return;
      }
      const data = results[0].result;
      if (data.error) {
        setStatus(selectStatus, data.error, 'error');
        return;
      }
      if (data.nonFollowers.length === 0) {
        setStatus(selectStatus, 'Everyone you follow follows you back!');
        return;
      }

      const existing = new Map(profiles.map(p => [p.username, p.selected]));
      profiles = data.nonFollowers.map(p => ({
        ...p,
        selected: existing.has(p.username) ? existing.get(p.username) : false
      }));

      setStatus(selectStatus,
        data.nonFollowers.length + ' non-followers found (of ' +
        data.followingCount + ' following, ' + data.followersCount + ' followers).');
      showSelectUI(true);
      renderProfiles(searchInput.value);
      updateSelectedCount();
    });
  });
});

function setSelectRunning(running) {
  unfollowSelectedBtn.disabled = running;
  stopSelectedBtn.disabled = !running;
  setAllLoadButtons(running);
  selectDelay.disabled = running;
  selectLimit.disabled = running;
  exportBtn.disabled = running;
  if (running) setStatus(selectStatus, 'Unfollowing selected...', 'running');
}

// ── Export CSV ──
exportBtn.addEventListener('click', () => {
  if (profiles.length === 0) return;
  const header = 'username,display_name,whitelisted';
  const rows = profiles.map(p =>
    '"' + p.username.replace(/"/g, '""') + '",' +
    '"' + (p.displayName || '').replace(/"/g, '""') + '",' +
    (whitelist.has(p.username) ? 'yes' : 'no')
  );
  const csv = header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'instagram_profiles_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
});

unfollowSelectedBtn.addEventListener('click', () => {
  let selected = profiles.filter(p => p.selected && !whitelist.has(p.username)).map(p => p.username);
  if (selected.length === 0) return;
  const delay = parseInt(selectDelay.value, 10);
  const limit = parseInt(selectLimit.value, 10);
  if (limit > 0) selected = selected.slice(0, limit);

  getInstagramTab((tab) => {
    if (!tab) return setStatus(selectStatus, 'Open Instagram first!', 'error');
    activeTabId = tab.id;
    setSelectRunning(true);
    selectCountEl.textContent = '0';
    showProgress('select-progress', 'select-progress-fill', 'select-progress-text',
      '0 / ' + selected.length + ' unfollowed', 0);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: selectiveUnfollow,
      args: [selected, delay]
    });
  });
});

stopSelectedBtn.addEventListener('click', () => {
  if (activeTabId !== null) {
    chrome.tabs.sendMessage(activeTabId, { type: 'stop-unfollow' });
    setSelectRunning(false);
    hideProgress('select-progress');
    setStatus(selectStatus, 'Stopped.');
  }
});

// ── Content scripts (injected into the page) ──

function scrapeProfiles() {
  function findScrollContainer() {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const scrollables = dialog.querySelectorAll('div');
      for (const div of scrollables) {
        if (div.scrollHeight > div.clientHeight && div.clientHeight > 100) {
          return div;
        }
      }
    }
    return null;
  }

  function getProfileEntries() {
    const results = [];
    const seen = new Set();
    const buttons = [...document.querySelectorAll('button')].filter(
      btn => btn.innerText === 'Following'
    );
    for (const btn of buttons) {
      let container = btn.closest('[class]');
      for (let i = 0; i < 10 && container; i++) {
        const links = container.querySelectorAll('a[href*="/"]');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href && href.match(/^\/[^/]+\/$/)) {
            const username = href.replace(/\//g, '');
            if (!seen.has(username) && username !== '') {
              seen.add(username);
              let displayName = '';
              const spans = container.querySelectorAll('span');
              for (const span of spans) {
                const text = span.textContent.trim();
                if (text && text !== username && text !== 'Following' &&
                    text !== 'Follow' && text !== 'Requested' &&
                    !text.includes('Verified') && text.length < 50) {
                  displayName = text;
                  break;
                }
              }
              results.push({ username, displayName });
            }
          }
        }
        container = container.parentElement;
        if (results.length > seen.size - 1) break;
      }
    }
    return results;
  }

  return new Promise((resolve) => {
    const scrollContainer = findScrollContainer();
    let lastCount = 0;
    let stableRounds = 0;

    async function scrollAndCollect() {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 50; i++) {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
        await wait(800);

        const entries = getProfileEntries();
        chrome.runtime.sendMessage({
          type: 'scrape-progress',
          text: entries.length + ' profiles loaded...',
          percent: null
        });
        if (entries.length === lastCount) {
          stableRounds++;
          if (stableRounds >= 3) break;
        } else {
          stableRounds = 0;
          lastCount = entries.length;
        }
      }
      resolve(getProfileEntries());
    }

    scrollAndCollect();
  });
}

function scrapeNonFollowers() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  function findScrollContainer() {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const scrollables = dialog.querySelectorAll('div');
      for (const div of scrollables) {
        if (div.scrollHeight > div.clientHeight && div.clientHeight > 100) {
          return div;
        }
      }
    }
    return null;
  }

  function scrapeUsernamesFromDialog() {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const seen = new Set();
    const links = dialog.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && href.match(/^\/[^/]+\/$/)) {
        const username = href.replace(/\//g, '');
        if (username) seen.add(username);
      }
    }
    return [...seen];
  }

  function scrapeFollowingFromDialog() {
    const results = [];
    const seen = new Set();
    const buttons = [...document.querySelectorAll('button')].filter(
      btn => btn.innerText === 'Following'
    );
    for (const btn of buttons) {
      let container = btn.closest('[class]');
      for (let i = 0; i < 10 && container; i++) {
        const links = container.querySelectorAll('a[href*="/"]');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href && href.match(/^\/[^/]+\/$/)) {
            const username = href.replace(/\//g, '');
            if (!seen.has(username) && username !== '') {
              seen.add(username);
              let displayName = '';
              const spans = container.querySelectorAll('span');
              for (const span of spans) {
                const text = span.textContent.trim();
                if (text && text !== username && text !== 'Following' &&
                    text !== 'Follow' && text !== 'Requested' &&
                    !text.includes('Verified') && text.length < 50) {
                  displayName = text;
                  break;
                }
              }
              results.push({ username, displayName });
            }
          }
        }
        container = container.parentElement;
        if (results.length > seen.size - 1) break;
      }
    }
    return results;
  }

  async function scrollDialogToEnd(label) {
    const scrollContainer = findScrollContainer();
    let lastCount = 0;
    let stableRounds = 0;

    for (let i = 0; i < 100; i++) {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
      await wait(800);

      const count = scrapeUsernamesFromDialog().length;
      chrome.runtime.sendMessage({
        type: 'scrape-progress',
        text: label + ': ' + count + ' loaded...',
        percent: null
      });
      if (count === lastCount) {
        stableRounds++;
        if (stableRounds >= 3) break;
      } else {
        stableRounds = 0;
        lastCount = count;
      }
    }
  }

  function closeDialog() {
    const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"]') ||
      document.querySelector('[role="dialog"] [aria-label="Close"]');
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  function clickListLink(text) {
    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && href.includes('/' + text + '/')) {
        link.click();
        return true;
      }
    }
    return false;
  }

  return new Promise(async (resolve) => {
    chrome.runtime.sendMessage({
      type: 'scrape-progress', text: 'Opening followers list...', percent: null
    });

    if (!clickListLink('followers')) {
      resolve({ error: 'Could not find followers link. Go to your profile page first.' });
      return;
    }
    await wait(2000);

    await scrollDialogToEnd('Followers');
    const followers = new Set(scrapeUsernamesFromDialog());

    closeDialog();
    await wait(1000);

    chrome.runtime.sendMessage({
      type: 'scrape-progress', text: 'Opening following list...', percent: null
    });

    if (!clickListLink('following')) {
      resolve({ error: 'Could not find following link.' });
      return;
    }
    await wait(2000);

    await scrollDialogToEnd('Following');
    const followingList = scrapeFollowingFromDialog();

    closeDialog();

    chrome.runtime.sendMessage({
      type: 'scrape-progress', text: 'Comparing lists...', percent: 100
    });

    const nonFollowers = followingList.filter(p => !followers.has(p.username));

    resolve({
      nonFollowers,
      followingCount: followingList.length,
      followersCount: followers.size
    });
  });
}

function scrapeLeastInteracted() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  function findScrollContainer() {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const scrollables = dialog.querySelectorAll('div');
      for (const div of scrollables) {
        if (div.scrollHeight > div.clientHeight && div.clientHeight > 100) {
          return div;
        }
      }
    }
    return null;
  }

  function getProfileEntries() {
    const results = [];
    const seen = new Set();
    const buttons = [...document.querySelectorAll('button')].filter(
      btn => btn.innerText === 'Following'
    );
    for (const btn of buttons) {
      let container = btn.closest('[class]');
      for (let i = 0; i < 10 && container; i++) {
        const links = container.querySelectorAll('a[href*="/"]');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href && href.match(/^\/[^/]+\/$/)) {
            const username = href.replace(/\//g, '');
            if (!seen.has(username) && username !== '') {
              seen.add(username);
              let displayName = '';
              const spans = container.querySelectorAll('span');
              for (const span of spans) {
                const text = span.textContent.trim();
                if (text && text !== username && text !== 'Following' &&
                    text !== 'Follow' && text !== 'Requested' &&
                    !text.includes('Verified') && text.length < 50) {
                  displayName = text;
                  break;
                }
              }
              results.push({ username, displayName });
            }
          }
        }
        container = container.parentElement;
        if (results.length > seen.size - 1) break;
      }
    }
    return results;
  }

  return new Promise(async (resolve) => {
    const allElements = document.querySelectorAll('a, button, span, div[role="button"]');
    let clicked = false;

    for (const el of allElements) {
      const text = (el.textContent || '').trim();
      if (text === 'Least Interacted With' || text === 'Least interacted with') {
        el.click();
        clicked = true;
        await wait(1500);
        break;
      }
    }

    if (!clicked) {
      for (const el of allElements) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'categories' || text === 'sort by default') {
          el.click();
          await wait(1000);
          const options = document.querySelectorAll('a, button, span, div[role="button"]');
          for (const opt of options) {
            const optText = (opt.textContent || '').trim();
            if (optText === 'Least Interacted With' || optText === 'Least interacted with') {
              opt.click();
              clicked = true;
              await wait(1500);
              break;
            }
          }
          if (clicked) break;
        }
      }
    }

    if (!clicked) {
      resolve([]);
      return;
    }

    const scrollContainer = findScrollContainer();
    let lastCount = 0;
    let stableRounds = 0;

    for (let i = 0; i < 50; i++) {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
      await wait(800);

      const entries = getProfileEntries();
      chrome.runtime.sendMessage({
        type: 'scrape-progress',
        text: entries.length + ' least interacted loaded...',
        percent: null
      });
      if (entries.length === lastCount) {
        stableRounds++;
        if (stableRounds >= 3) break;
      } else {
        stableRounds = 0;
        lastCount = entries.length;
      }
    }

    resolve(getProfileEntries());
  });
}

function massUnfollow(delayMs, whitelistArr, maxLimit) {
  if (window.__unfollowRunning) return;
  window.__unfollowRunning = true;

  const whitelistSet = new Set(whitelistArr);
  const limit = maxLimit || 0;
  let count = 0;
  let skipped = 0;
  let stopped = false;
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  function onMessage(message, _sender, sendResponse) {
    if (message.type === 'stop-unfollow') {
      stopped = true;
      sendResponse({ ok: true });
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  function getFollowingButtons() {
    return [...document.querySelectorAll('button')].filter(
      btn => btn.innerText === 'Following'
    );
  }

  function getUsernameForButton(btn) {
    let container = btn.closest('[class]');
    for (let i = 0; i < 10 && container; i++) {
      const links = container.querySelectorAll('a[href*="/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href.match(/^\/[^/]+\/$/)) {
          return href.replace(/\//g, '');
        }
      }
      container = container.parentElement;
    }
    return null;
  }

  async function unfollowOne(btn) {
    const username = getUsernameForButton(btn);
    if (username && whitelistSet.has(username)) {
      skipped++;
      console.log('Skipped (whitelisted):', username);
      return;
    }

    btn.click();
    await wait(800);
    const confirmBtn = [...document.querySelectorAll('button')].find(
      b => b.innerText === 'Unfollow'
    );
    if (confirmBtn) {
      confirmBtn.click();
      count++;
      chrome.runtime.sendMessage({ type: 'unfollow-count', count, skipped });
      console.log('Unfollowed:', username || count);
      await wait(delayMs);
    }
  }

  async function run() {
    try {
      let emptyRounds = 0;
      while (!stopped && (limit === 0 || count < limit)) {
        const buttons = getFollowingButtons();
        if (buttons.length === 0) {
          window.scrollBy(0, 600);
          await wait(1500);
          emptyRounds++;
          if (emptyRounds >= 5) break;
          continue;
        }
        emptyRounds = 0;
        for (const btn of buttons) {
          if (stopped || (limit > 0 && count >= limit)) break;
          await unfollowOne(btn);
        }
        window.scrollBy(0, 600);
        await wait(1000);
      }
      chrome.runtime.sendMessage({ type: 'unfollow-done', count });
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'unfollow-error', error: err.message });
    } finally {
      chrome.runtime.onMessage.removeListener(onMessage);
      window.__unfollowRunning = false;
    }
  }

  run();
}

function selectiveUnfollow(usernames, delayMs) {
  if (window.__unfollowRunning) return;
  window.__unfollowRunning = true;

  let count = 0;
  let stopped = false;
  const total = usernames.length;
  const remaining = new Set(usernames);
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  function onMessage(message, _sender, sendResponse) {
    if (message.type === 'stop-unfollow') {
      stopped = true;
      sendResponse({ ok: true });
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  function findScrollContainer() {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const scrollables = dialog.querySelectorAll('div');
      for (const div of scrollables) {
        if (div.scrollHeight > div.clientHeight && div.clientHeight > 100) {
          return div;
        }
      }
    }
    return null;
  }

  function findButtonForUser(username) {
    const links = document.querySelectorAll('a[href="/' + username + '/"]');
    for (const link of links) {
      let container = link.parentElement;
      for (let i = 0; i < 10 && container; i++) {
        const btn = [...container.querySelectorAll('button')].find(
          b => b.innerText === 'Following'
        );
        if (btn) return btn;
        container = container.parentElement;
      }
    }
    return null;
  }

  async function run() {
    try {
      const scrollContainer = findScrollContainer();
      let emptyRounds = 0;

      while (!stopped && remaining.size > 0) {
        let foundAny = false;

        for (const username of [...remaining]) {
          if (stopped) break;
          const btn = findButtonForUser(username);
          if (!btn) continue;

          foundAny = true;
          btn.click();
          await wait(800);

          const confirmBtn = [...document.querySelectorAll('button')].find(
            b => b.innerText === 'Unfollow'
          );
          if (confirmBtn) {
            confirmBtn.click();
            count++;
            remaining.delete(username);
            chrome.runtime.sendMessage({ type: 'selective-count', count, total });
            console.log('Unfollowed:', username, '(' + count + '/' + total + ')');
            await wait(delayMs);
          }
        }

        if (!foundAny) {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          } else {
            window.scrollBy(0, 600);
          }
          await wait(1500);
          emptyRounds++;
          if (emptyRounds >= 5) break;
        } else {
          emptyRounds = 0;
        }
      }

      chrome.runtime.sendMessage({ type: 'selective-done', count, total });
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'selective-error', error: err.message });
    } finally {
      chrome.runtime.onMessage.removeListener(onMessage);
      window.__unfollowRunning = false;
    }
  }

  run();
}
