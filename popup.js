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
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  function getUnfollowButtons() {
    return [...document.querySelectorAll('button')].filter(btn => btn.innerText === 'Following');
  }

  async function unfollow() {
    const buttons = getUnfollowButtons();
    for (const btn of buttons) {
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
    while (getUnfollowButtons().length > 0) {
      await unfollow();
      window.scrollTo(0, document.body.scrollHeight);
      await delay(2000);
    }
    alert(`Mass unfollow complete! Unfollowed ${count} accounts.`);
  }

  startUnfollowing();
}
