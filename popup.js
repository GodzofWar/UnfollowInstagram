document.getElementById('start').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: massUnfollow
    });
  });
});

function massUnfollow() {
  let count = 0;
  let stop = false;

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  function getUnfollowButtons() {
    return [...document.querySelectorAll('button')].filter(btn => btn.innerText === 'Following');
  }

  async function scrollToLoadMore() {
    window.scrollBy(0, 500);
    await delay(1000);
  }

  async function unfollow() {
    const buttons = getUnfollowButtons();
    for (const btn of buttons) {
      if (stop) break;

      btn.click();
      await delay(1000);

      const confirm = [...document.querySelectorAll('button')].find(b => b.innerText === 'Unfollow');
      if (confirm) {
        confirm.click();
        count++;
        console.log(`Unfollowed: ${count}`);
        await delay(3000);
      }
    }
  }

  async function startUnfollowing() {
    while (!stop) {
      await unfollow();
      await scrollToLoadMore();

      // If no more unfollow buttons and page is at bottom
      if (getUnfollowButtons().length === 0 && (window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
        break;
      }
    }

    alert(`Mass unfollow complete! Unfollowed ${count} accounts.`);
  }

  startUnfollowing();

  // Listen for stop message
  window.addEventListener('message', (event) => {
    if (event.data === 'STOP_UNFOLLOW') {
      stop = true;
      console.log('Stopping unfollow process...');
    }
  });
}
