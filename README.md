# UnfollowInstagram

Chrome Extension for managing your Instagram following list. Mass unfollow, selectively unfollow, find non-followers, and more — with configurable delays to avoid rate limits.

## Install

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right corner)
3. Click **"Load unpacked"** and select the UnfollowInstagram folder
4. The extension should now be visible in your Chrome toolbar

## Features

### Unfollow All

Mass unfollow everyone on your following list. Navigate to your following page, click the extension, and hit Start.

- **Configurable delay** between unfollows: Fast (2s), Normal (4s), Slow (8s), Very Slow (15s)
- **Unfollow limit** per session: 50, 100, 200, 500, or no limit (default: 100)
- **Whitelist-aware** — automatically skips protected accounts
- **Live counter** and progress bar
- **Stop button** to cancel at any time

### Select Profiles

Load your following list into a checklist and pick exactly who to unfollow. Three ways to load profiles:

- **Load All** — scrolls through the following list dialog and loads every profile
- **Least Interacted** — clicks Instagram's built-in "Least Interacted With" category and loads only those profiles
- **Non-Followers** — scans both your followers and following lists, then shows only people who don't follow you back (must be on your own profile page)

Once loaded:
- **Search** to filter by username or display name
- **Select All** / individual checkboxes to choose who to unfollow
- **Shield button** on each profile to quickly add them to the whitelist
- **Export as CSV** to download the list as a backup before unfollowing
- **Unfollow Selected** with its own delay and limit settings

### Whitelist

Protect accounts you never want to unfollow (close friends, family, etc.).

- Add usernames manually (supports `@username` format)
- **Import from CSV** — bulk-add protected accounts from a `.csv` or `.txt` file
- Quick-protect from the profile list with the shield button
- Protected accounts are dimmed and disabled in the profile list
- Skipped automatically during mass unfollow
- Persisted across browser sessions via Chrome storage

### History & Undo

Track every account you unfollow and optionally re-follow them.

- **Unfollow log** — each unfollowed account is recorded with a timestamp
- **Re-follow button** — opens the profile in a background tab and automatically clicks Follow
- **Clear history** to reset the log

### Safety Features

- **Action block detection** — automatically stops if Instagram shows "Try Again Later" or "Action Blocked"
- **Cooldown timer** — 24-hour countdown banner after an unfollow session to help you avoid rate limits
- **Configurable limits** — cap unfollows per session (50, 100, 200, 500, or unlimited)

### Progress Tracking

- **Animated progress bar** on all operations (indeterminate during scraping, percentage-based during unfollowing)
- **Live text updates** showing profile count during loading ("Followers: 380 loaded...")
- **Completion summary** with counts and limit-reached indicator

### Dark Mode

Automatically matches your system theme — no toggle needed. Uses CSS custom properties with `prefers-color-scheme` media query.

## Usage

### Mass Unfollow Everyone

1. Open Instagram and navigate to your following list: `https://www.instagram.com/yourusername/following/`
2. Click the extension icon
3. Set your preferred delay and limit
4. Press **Start**

### Unfollow Non-Followers

1. Navigate to your own Instagram profile page: `https://www.instagram.com/yourusername/`
2. Click the extension icon
3. Go to the **Select** tab
4. Click **Non-Followers** — the extension will open your followers dialog, scroll through it, close it, then do the same for your following list
5. Review the results, optionally protect accounts with the shield button
6. Select the ones you want to unfollow and click **Unfollow Selected**

### Unfollow Least Interacted

1. Open your following list on Instagram
2. Click the extension icon
3. Go to the **Select** tab
4. Click **Least Interacted** — the extension will click Instagram's category filter and load those profiles
5. Select and unfollow
