let unfollowing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startUnfollow") {
    unfollowing = true;
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      function: massUnfollow
    });
  } else if (message.action === "stopUnfollow") {
    unfollowing = false;
  }
});

async function massUnfollow() {
  let count = 0;
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  function getUnfollowButtons() {
    return [...document.querySelectorAll('button')].filter(btn => btn.innerText === 'Following');
  }

  async function unfollow() {
    const buttons = getUnfollowButtons();
    for (const btn of buttons) {
      if (!unfollowing) return; // Stop if the user cancels
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

  while (getUnfollowButtons().length > 0 && unfollowing) {
    await unfollow();
    window.scrollTo(0, document.body.scrollHeight);
    await delay(2000);
  }
  alert(`Mass unfollow complete! Unfollowed ${count} accounts.`);
}
