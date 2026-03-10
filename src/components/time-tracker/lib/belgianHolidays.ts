"use client";
// Belgian public/bank holidays calculator

interface Holiday {
  date: Date;
  name: string;
  nameNl: string;
  nameFr: string;
}

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month, day);
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Get all Belgian public holidays for a given year
export function getBelgianHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year);
  
  return [
    // Fixed holidays
    {
      date: new Date(year, 0, 1),
      name: "New Year's Day",
      nameNl: "Nieuwjaar",
      nameFr: "Jour de l'An",
    },
    {
      date: new Date(year, 4, 1),
      name: "Labour Day",
      nameNl: "Dag van de Arbeid",
      nameFr: "Fête du Travail",
    },
    {
      date: new Date(year, 6, 21),
      name: "Belgian National Day",
      nameNl: "Nationale Feestdag",
      nameFr: "Fête Nationale",
    },
    {
      date: new Date(year, 7, 15),
      name: "Assumption of Mary",
      nameNl: "Onze-Lieve-Vrouw-Hemelvaart",
      nameFr: "Assomption",
    },
    {
      date: new Date(year, 10, 1),
      name: "All Saints' Day",
      nameNl: "Allerheiligen",
      nameFr: "Toussaint",
    },
    {
      date: new Date(year, 10, 11),
      name: "Armistice Day",
      nameNl: "Wapenstilstand",
      nameFr: "Jour de l'Armistice",
    },
    {
      date: new Date(year, 11, 25),
      name: "Christmas Day",
      nameNl: "Kerstmis",
      nameFr: "Noël",
    },
    // Easter-based holidays
    {
      date: easter,
      name: "Easter Sunday",
      nameNl: "Pasen",
      nameFr: "Pâques",
    },
    {
      date: addDays(easter, 1),
      name: "Easter Monday",
      nameNl: "Paasmaandag",
      nameFr: "Lundi de Pâques",
    },
    {
      date: addDays(easter, 39),
      name: "Ascension Day",
      nameNl: "Onze-Lieve-Heer-Hemelvaart",
      nameFr: "Ascension",
    },
    {
      date: addDays(easter, 49),
      name: "Whit Sunday",
      nameNl: "Pinksteren",
      nameFr: "Pentecôte",
    },
    {
      date: addDays(easter, 50),
      name: "Whit Monday",
      nameNl: "Pinkstermaandag",
      nameFr: "Lundi de Pentecôte",
    },
  ];
}

// Check if a date is a Belgian public holiday
export function isBelgianHoliday(date: Date): Holiday | null {
  const year = date.getFullYear();
  const holidays = getBelgianHolidays(year);
  
  return holidays.find(h => 
    h.date.getFullYear() === date.getFullYear() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getDate() === date.getDate()
  ) || null;
}

// Get holidays for a date range
export function getHolidaysInRange(startDate: Date, endDate: Date): Holiday[] {
  const holidays: Holiday[] = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getBelgianHolidays(year);
    holidays.push(...yearHolidays.filter(h => 
      h.date >= startDate && h.date <= endDate
    ));
  }
  
  return holidays;
}

// Format date as YYYY-MM-DD for comparison
export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Get a map of holidays by date key for quick lookup
export function getHolidayMap(year: number): Map<string, Holiday> {
  const holidays = getBelgianHolidays(year);
  const map = new Map<string, Holiday>();
  
  holidays.forEach(h => {
    map.set(formatDateKey(h.date), h);
  });
  
  return map;
}
