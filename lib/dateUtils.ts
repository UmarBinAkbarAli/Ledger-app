export function getPakistanDate(offsetDays = 0) {
  // 1. Get current time in Pakistan
  const now = new Date();
  
  // 2. Convert to Pakistan Time string
  const pktString = now.toLocaleString("en-US", { timeZone: "Asia/Karachi" });
  const pktDate = new Date(pktString);

  // 3. Add/Subtract days if needed (for "Last 7 Days" logic)
  if (offsetDays !== 0) {
    pktDate.setDate(pktDate.getDate() + offsetDays);
  }

  // 4. Return YYYY-MM-DD format
  // en-CA locale always returns YYYY-MM-DD
  return pktDate.toLocaleDateString("en-CA");
}