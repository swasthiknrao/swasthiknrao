const GITHUB_API = 'https://api.github.com';
const STORAGE_KEYS = {
  USERNAME: 'gh-streak-username',
  DISMISSED: 'gh-streak-dismissed',
};

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('username');
  const saved = localStorage.getItem(STORAGE_KEYS.USERNAME);
  const username = saved || input.value.trim() || 'swasthiknrao';
  input.value = username;
  if (username) fetchActivity(username);
  else renderWeekDots([]);
  updateReminder();
});

document.getElementById('fetchBtn').addEventListener('click', () => {
  const username = document.getElementById('username').value.trim();
  if (!username) return;
  localStorage.setItem(STORAGE_KEYS.USERNAME, username);
  fetchActivity(username);
});

document.getElementById('dismissBtn').addEventListener('click', () => {
  const today = new Date().toDateString();
  localStorage.setItem(STORAGE_KEYS.DISMISSED, today);
  updateReminder();
});

function calcStreak(contribDates) {
  const set = new Set(contribDates);
  if (!set.size) return 0;
  let streak = 0;
  let d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  for (let i = 0; i < 365; i++) {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (set.has(key)) streak++;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function renderWeekDots(contribDates) {
  const set = new Set(contribDates);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const el = document.getElementById('weekDots');
  el.innerHTML = '';
  let d = new Date();
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const has = set.has(key);
    const dot = document.createElement('span');
    dot.className = `dot ${has ? 'active' : ''}`;
    dot.title = `${days[d.getDay()]} ${key}${has ? ' ✓' : ''}`;
    el.appendChild(dot);
    d.setDate(d.getDate() + 1);
  }
}

async function fetchActivity(username) {
  document.getElementById('eventCount').textContent = '...';
  document.getElementById('todayContrib').textContent = '...';
  document.getElementById('streakCount').textContent = '...';

  try {
    const to = new Date();
    const from = new Date(to);
    from.setFullYear(from.getFullYear() - 1);

    const query = `
      query($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          username,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      }),
    });

    const json = await res.json();
    if (json.errors || !json.data?.user) throw new Error('User not found');

    const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
    const contribDates = [];
    let totalContrib = 0;
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        totalContrib += day.contributionCount;
        if (day.contributionCount > 0) contribDates.push(day.date);
      }
    }

    const todayStr = to.toISOString().slice(0, 10);
    const todayContrib = weeks.flatMap((w) => w.contributionDays).find((d) => d.date === todayStr)?.contributionCount ?? 0;
    const weekAgo = new Date(to);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekContrib = weeks.flatMap((w) => w.contributionDays)
      .filter((d) => d.date >= weekAgo.toISOString().slice(0, 10))
      .reduce((s, d) => s + d.contributionCount, 0);

    const streak = calcStreak(contribDates);

    document.getElementById('eventCount').textContent = weekContrib;
    document.getElementById('todayContrib').textContent = todayContrib;
    document.getElementById('streakCount').textContent = streak || '0';
    document.getElementById('streakCount').className = `stat-value ${streak > 0 ? 'on-fire' : ''}`;

    renderWeekDots(contribDates);
  } catch (err) {
    document.getElementById('eventCount').textContent = '—';
    document.getElementById('todayContrib').textContent = '—';
    document.getElementById('streakCount').textContent = '0';
    renderWeekDots([]);
  }
}

function updateReminder() {
  const today = new Date().toDateString();
  const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED);
  const textEl = document.getElementById('reminderText');

  if (dismissed === today) {
    textEl.textContent = "You dismissed the reminder. Come back tomorrow!";
  } else {
    textEl.textContent = "Don't forget to make at least one contribution today to keep your streak! Update streak-log.md or push a commit.";
  }
}
