# תיעוד פיתוח - לוח שנה עברי

## סקירה כללית

תוסף זה מספק לוח שנה עברי-לועזי משולב לאוצריא, עם עיצוב Material Design 3 מלא.

## ארכיטקטורה

### קבצים עיקריים

1. **src/index.html** - מבנה HTML של הלוח
   - סרגל עליון עם כפתורי ניווט
   - כותרת חודש/שנה
   - מתג תצוגה (חודש/שבוע)
   - גריד של ימים

2. **src/styles.css** - עיצוב מלא
   - Material Design 3 tokens
   - Responsive design
   - תמיכה ב-RTL
   - אנימציות ומעברים

3. **src/main.ts** - לוגיקה ראשית
   - ניהול state (תאריך נוכחי, נבחר, תצוגה)
   - חישובי תאריך עברי
   - רינדור הלוח
   - טיפול באירועים
   - אינטגרציה עם Otzaria SDK

### מבנה State

```typescript
let currentDate = new Date();      // החודש המוצג
let selectedDate = new Date();     // התאריך הנבחר
let currentView: 'month' | 'week'; // סוג התצוגה
let theme: any;                    // נושא צבעים מ-Otzaria
```

### תהליך רינדור

1. `generateCalendarDays()` - יוצר מערך של 42 (חודש) או 7 (שבוע) ימים
2. לכל יום מחושב:
   - תאריך גרגוריאני
   - תאריך עברי (דרך Otzaria API)
   - סטטוס (היום, נבחר, חודש אחר, שבת)
   - חגים ומועדים
3. `createDayCell()` - יוצר DOM element לכל יום
4. `renderCalendar()` - מרכיב הכל ביחד

## אינטגרציה עם Otzaria

### Events

```typescript
// טעינה ראשונית
Otzaria.on('plugin.boot', (bootData) => {
  applyTheme(bootData.theme);
  setupEventListeners();
  renderCalendar();
});

// שינוי נושא
Otzaria.on('theme.changed', (themeData) => {
  applyTheme(themeData);
});
```

### API Calls

```typescript
// קבלת תאריך עברי
const response = await Otzaria.call('calendar.getJewishDate', {
  date: gregorianDate.toISOString()
});
```

## חישובי תאריך עברי

### המרת מספרים לעברית

```typescript
function numberToHebrew(num: number): string {
  // טיפול מיוחד ב-15, 16 (טו, טז)
  // המרה לפי ספרות אחדות, עשרות, מאות
}
```

### פורמט שנה עברית

```typescript
function formatHebrewYear(year: number): string {
  // ה׳תשפ״ה
  // מוסיף ה׳ לאלפים, גרשיים לסוף
}

```

## עיצוב Material Design 3

### Color Scheme

הלוח משתמש ב-color tokens מ-Otzaria:
- `primary` - תאריך נוכחי, כפתורים פעילים
- `primaryContainer` - תאריך נבחר
- `secondaryContainer` - שבתות, מועדים
- `surface` - רקע תאים
- `onSurface` - טקסט
- `outline` - גבולות

### Typography

- Roboto - פונט ראשי
- Material Icons - אייקונים

### Elevation

- תאים: 0dp (רגיל), 2dp (hover/today)
- כפתורים: 0dp (flat)

## Responsive Design

### Breakpoints

- Mobile: < 768px
  - כפתורים קטנים יותר
  - פונטים מותאמים
  
- Compact height: < 600px
  - תאים קטנים יותר
  - פחות מידע בכל תא

### Grid Layout

- תצוגת חודש: 7 עמודות × 6 שורות
- תצוגת שבוע: 7 עמודות × 1 שורה

## הרחבות עתידיות

### אפשרויות להוספה

1. **אירועים מותאמים אישית**
   - שימוש ב-`published_data.write` permission
   - שמירה ב-plugin storage
   - סנכרון עם Google Calendar

2. **זמני היום**
   - שימוש ב-`calendar.getDailyTimes`
   - הצגה בתאים או בפאנל צד

3. **חיפוש תאריך**
   - דיאלוג קפיצה לתאריך
   - פירוש קלט עברי/לועזי

4. **הדפסה**
   - ייצוא PDF
   - בחירת טווח תאריכים

5. **הגדרות**
   - בחירת עיר (לזמנים)
   - ארץ ישראל / חו״ל
   - סוג לוח (עברי/לועזי/משולב)

## טיפים לפיתוח

### Hot Reload

במצב פיתוח, כל שמירה של קובץ תרענן אוטומטית את התוסף.

### Debugging

```typescript
console.log('Debug info:', data);
```

הקונסול זמין ב-DevTools של אוצריא (F12).

### Testing

1. בדוק תצוגת חודש ושבוע
2. נווט בין חודשים
3. בחר תאריכים שונים
4. החלף בין נושא בהיר וכהה
5. בדוק responsive (שנה גודל חלון)

## בעיות נפוצות

### תאריכים עבריים לא מדויקים

אם ה-API של Otzaria לא זמין, יש fallback פשוט. לדיוק מלא, וודא ש:
- ההרשאה `calendar.read` מאושרת
- אוצריא רצה בגרסה 0.9.0+

### עיצוב לא מתעדכן

וודא ש-`applyTheme()` נקרא אחרי כל שינוי state.

### ביצועים

אם הרינדור איטי:
- שקול caching של תאריכים עבריים
- השתמש ב-`requestAnimationFrame` לאנימציות
- הגבל את מספר ה-DOM updates

## תרומה

לפני שליחת PR:
1. הרץ `npm run build` ווודא שאין שגיאות
2. בדוק ב-2 נושאים (בהיר/כהה)
3. בדוק responsive
4. עדכן README אם צריך
