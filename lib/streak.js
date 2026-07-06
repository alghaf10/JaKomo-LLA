export const toDateKey = (value) => new Date(value).toDateString();

export const computeStreak = (dateValues) => {
  const daysWithActivity = new Set(dateValues.map(toDateKey));

  const cursor = new Date();
  if (!daysWithActivity.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (daysWithActivity.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const getMonthGrid = (viewedDate) => {
  const year = viewedDate.getFullYear();
  const month = viewedDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};
